var async = require("async");
var db = require.main.require('./utils/databases');
var moment = require('moment');
var logger = require.main.require('./utils/logger');

exports = module.exports = function (io)
{
    io.sockets.on('connection', function (socket)
    {
        socket.on('send message', function (data)
        {
            if (typeof socket.handshake.session.user !== 'undefined')
            {
                var user;
                var datetime;
                var insertedID;
                var primaryGroupID;
                var primaryGroupColor;
                async.series([
                    function (callback)
                    {
                        var startTime = moment().format("YYYY-MM-DD HH:mm:ss");

                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT * FROM chat_bans WHERE chat_ban_user_id = ? AND chat_ban_end > ?",
                                timeout: 30000,
                                values: [socket.handshake.session.user.user_id, startTime]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Error vid hämtning av Chat Bans för user  = " + JSON.stringify(socket.handshake.session.user));
                                    socket.emit("chat submit info", "Internt server fel, försök igen om ett tag.");
                                    return callback(true);
                                }
                                else
                                {
                                    // Om vi hittar, är usern bannad och får inte posta
                                    if (results.length > 0)
                                    {
                                        socket.emit("Lägg ner vafan!");
                                        return callback(true);
                                    }
                                    else
                                    {
                                        callback();
                                    }
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        if (data.trim().length > 140)
                        {
                            socket.emit("chat submit info", "Ditt meddelande får max vara 140 tecken långt.");
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    },
                    function (callback)
                    {
                        if (data.trim().length < 3)
                        {
                            socket.emit("chat submit info", "Ditt meddelande måste vara minst 3 tecken långt.");
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    },
                    function (callback)
                    {
                        if (socket.handshake.session.user.permissions.chat_submit === 1)
                        {
                            datetime = new Date();

                            db.getForumConnection(function (err, connection)
                            {
                                connection.query({
                                    sql: "INSERT INTO chat SET chat_user_id = ?, chat_message = ?, chat_datetime = ?",
                                    timeout: 30000,
                                    values: [socket.handshake.session.user.user_id, data.trim(), datetime]
                                }, function (error, results)
                                {
                                    connection.release();
                                    if (error)
                                    {
                                        logger.info("Error vid insättnings av chattmeddelande = " + JSON.stringify(socket.handshake.session.user));
                                        socket.emit("chat submit info", "Internt server fel, försök igen om ett tag.");
                                        return callback(true);
                                    }
                                    else
                                    {
                                        // Success
                                        insertedID = results.insertId;
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
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT uag_group_id FROM users_active_groups WHERE uag_user_id = ? AND uag_primary_group = 1",
                                timeout: 30000,
                                values: [socket.handshake.session.user.user_id]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Hittade ingen user grupp chat skapande = " + JSON.stringify(socket.handshake.session.user));
                                    socket.emit("chat submit info", "Internt server fel, försök igen om ett tag.");
                                    return callback(true);
                                }
                                else
                                {
                                    primaryGroupID = results[0].uag_group_id;
                                    callback();
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT color FROM user_groups WHERE group_id = ?",
                                timeout: 30000,
                                values: [primaryGroupID]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Hittade ingen user grupp color chat skapande = " + JSON.stringify(socket.handshake.session.user));
                                    socket.emit("chat submit info", "Internt server fel, försök igen om ett tag.");
                                    return callback(true);
                                }
                                else
                                {
                                    primaryGroupColor = results[0].color;
                                    callback();
                                }
                            });
                        });
                    }
                ], function (error)
                {
                    if (error)
                    {
                        // blabla
                    }
                    else
                    {
                        var returnInfo = {
                            'user_id': socket.handshake.session.user.user_id,
                            'username': socket.handshake.session.user.username,
                            'color': primaryGroupColor,
                            'message': data.trim(),
                            'datetime': datetime,
                            'chatID': insertedID
                        };

                        socket.emit("chat submit info", "success");
                        io.sockets.emit('new message', returnInfo);
                    }
                });
            }
            else
            {
                socket.emit("noPermission");
            }
        });
    });
}