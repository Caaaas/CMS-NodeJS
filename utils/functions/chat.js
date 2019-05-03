var async = require("async");
var db = require.main.require('./utils/databases');
var moment = require('moment');

function sendChat(req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = res.locals.session.user;
    else
        userData = null;

    var chat;
    async.series([
        function (callback)
        {
            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql:
                    "(SELECT chat.*, " +
                    "u1.username AS chat_username," +
                    "ban1.chat_ban_user_id " +
                    "FROM chat " +
                    "LEFT JOIN users u1 ON u1.user_id = chat.chat_user_id " +
                    "LEFT JOIN chat_bans ban1 ON ban1.chat_ban_user_id = chat.chat_user_id AND ban1.chat_ban_end > NOW() " +
                    "WHERE chat_hidden = '0' " +
                    "ORDER BY chat_id DESC LIMIT 30) " +
                    "ORDER BY chat_id ASC",
                    timeout: 30000
                }, function (error, results)
                {
                    connection.release();
                    if (error)
                    {
                        logger.info(error);
                        res.sendStatus(503);
                        return callback(true);
                    }
                    else
                    {
                        chat = results;
                        callback();
                    }
                });
            });
        },
        function (callback)
        {
            var count = 0;
            if (chat.length === 0)
                callback();
            else
            {
                chat.forEach(function (datum, i)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "SELECT uag_group_id FROM users_active_groups WHERE uag_user_id = ? AND uag_primary_group = 1",
                            timeout: 30000,
                            values: [chat[i].chat_user_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return callback(true);
                            }
                            else
                            {
                                chat[i].chat_user_primary_group = results[0].uag_group_id;
                                count++;
                                if (count == chat.length)
                                    callback();
                            }
                        });
                    });
                })
            }
        },
        function (callback)
        {
            var count = 0;
            if (chat.length === 0)
                callback();
            else
            {
                chat.forEach(function (datum, i)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "SELECT color FROM user_groups WHERE group_id = ?",
                            timeout: 30000,
                            values: [chat[i].chat_user_primary_group]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return callback(true);
                            }
                            else
                            {
                                chat[i].chat_user_primary_group_color = results[0].color;
                                count++;
                                if (count == chat.length)
                                    callback();
                            }
                        });
                    });
                })
            }
        },
        function (callback)
        {
            if (typeof req.session.user !== 'undefined')
            {
                var startTime = moment().format("YYYY-MM-DD HH:mm:ss");
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT * FROM chat_bans WHERE chat_ban_user_id = ? AND chat_ban_end > ?",
                        timeout: 30000,
                        values: [req.session.user.user_id, startTime]
                    }, function (error, results, fields)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            if (results.length > 0)
                                chat.ban = 1;
                            else
                                chat.ban = 0;

                            callback();
                        }
                    });
                });
            }
            else
            {
                callback();
            }
        },
        function (callback)
        {
            if (userData !== null)
            {
                async.eachOf(chat, function (chatData, index, nextInner)
                {
                    canEditChat(userData, chatData, function (response)
                    {
                        if (response === false)
                        {
                            chatData.editChat = false;
                            nextInner();
                        }
                        else
                        {
                            chatData.editChat = true;
                            nextInner();
                        }
                    });
                }, function (error)
                {
                    if (error)
                    {
                        logger.info(error);
                        var resErr = new Error();
                        resErr.status = 503;
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                });
            }
            else
            {
                callback();
            }
        },
        function (callback)
        {
            if (userData !== null)
            {
                async.eachOf(chat, function (chatData, index, nextInner)
                {
                    canDeleteChat(userData, chatData, function (response)
                    {
                        if (response === false)
                        {
                            chatData.deleteChat = false;
                            nextInner();
                        }
                        else
                        {
                            chatData.deleteChat = true;
                            nextInner();
                        }
                    });
                }, function (error)
                {
                    if (error)
                    {
                        logger.info(error);
                        var resErr = new Error();
                        resErr.status = 503;
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                });
            }
            else
            {
                callback();
            }
        }
    ], function (error)
    {
        if (error)
        {
            // Allt hanteras enskilt
            return next(true)
        }
        else
        {
            req.chat = chat;
            res.locals.chat = chat;
            next();
        }
    });
}

function canEditChat(user, chatData, next)
{
    var currentTime = moment();

    async.parallel([
            function (callback)
            {
                if (user == null)
                {
                    return callback(true);
                }
                else
                {
                    if (user.permissions.chat_edit_all)
                    {
                        callback();
                    }
                    else if (user.permissions.chat_edit_own && chatData.chat_user_id == user.user_id)
                    {
                        if (user.permissions.chat_edit_own_time > 0)
                        {
                            var chatMaxEditTime = moment(chatData.chat_datetime).add(user.permissions.chat_edit_own_time, "m");

                            if (chatMaxEditTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
            },
            function (callback)
            {
                if (chatData.chat_hidden)
                {
                    if (user.permissions.chat_hide_all)
                    {
                        callback();
                    }
                    else if (user.permissions.chat_hide_own && chatData.chat_user_id == user.user_id)
                    {
                        if (user.permissions.chat_hide_own_time > 0)
                        {
                            var chatMaxHideTime = moment(chatData.chat_datetime).add(user.permissions.chat_hide_own_time, "m");

                            if (chatMaxHideTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
                else
                {
                    callback();
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });
}

function canDeleteChat(user, chatData, next)
{
    async.parallel([
            function (callback)
            {
                if (user.permissions.chat_hide_all)
                {
                    callback();
                }
                else if (user.permissions.chat_hide_own && chatData.chat_user_id == user.user_id)
                {
                    if (user.permissions.chat_hide_own_time > 0)
                    {
                        var chatMaxHideTime = moment(chatData.chat_datetime).add(user.permissions.chat_hide_own_time, "m");

                        if (chatMaxHideTime.isSameOrAfter(currentTime))
                        {
                            callback();
                        }
                        else
                        {
                            return callback(true);
                        }
                    }
                    else
                    {
                        callback();
                    }
                }
                else
                {
                    return callback(true);
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });
}

module.exports = {
    canEditChat: canEditChat,
    canDeleteChat: canDeleteChat,
    sendChat: sendChat
}