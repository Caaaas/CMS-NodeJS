var db = require.main.require('./utils/databases');
var async = require("async");
var logger = require.main.require('./utils/logger');

function getPermissions(req, res, next)
{
    var user = {};
    if (typeof req.session.user !== 'undefined')
    {
        var userID = req.session.user.user_id;
        async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT * FROM users WHERE user_id = ?",
                        timeout: 30000,
                        values: [userID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(error);
                        }
                        else
                        {
                            user = results[0];
                            delete user.password;

                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                user.groups = [];
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT * FROM users_active_groups WHERE uag_user_id = ?",
                        timeout: 30000,
                        values: [userID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(error);
                        }
                        else
                        {
                            // Success
                            user.groups = results;

                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                user.excluded_boards = [];
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT ueb_board_id FROM user_excluded_boards WHERE ueb_user_id = ?",
                        timeout: 30000,
                        values: [userID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(error);
                        }
                        else
                        {
                            for (var i = 0; i < results.length; i++)
                            {
                                user.excluded_boards.push(results[i].ueb_board_id);
                            }

                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                user.excluded_topics = [];
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT uet_topic_id FROM user_excluded_topics WHERE uet_user_id = ?",
                        timeout: 30000,
                        values: [userID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(error);
                        }
                        else
                        {
                            for (var i = 0; i < results.length; i++)
                            {
                                user.excluded_topics.push(results[i].uet_topic_id);
                            }
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.eachOf(user.groups, function (group, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "SELECT * FROM user_groups WHERE group_id = ?",
                            timeout: 30000,
                            values: [group.uag_group_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return nextInner(error);
                            }
                            else
                            {
                                user.groups[index] = {
                                    'group_id': results[0].group_id,
                                    'name': results[0].name,
                                    'color': results[0].color,
                                    'custom_order': results[0].custom_order
                                };

                                if (typeof user.permissions === 'undefined')
                                {
                                    user.permissions = {};
                                    for (var attr in results[0])
                                    {
                                        if (attr != 'group_id' &&
                                            attr != 'name' &&
                                            attr != 'color' &&
                                            attr != 'custom_order')
                                        {
                                            user.permissions[attr] = results[0][attr];
                                        }
                                    }
                                }
                                else
                                {
                                    mergeGroupPermissions(user.permissions, results[0], function (mergeResponse)
                                    {
                                        user.permissions = mergeResponse;
                                    });
                                }

                                nextInner();
                            }
                        });
                    }.bind(db));
                }, function (error)
                {
                    if (error)
                    {
                        logger.info(error);
                        return callback(error);
                    }
                    else
                    {
                        user.groups.sort(function (a, b)
                        {
                            return (a.custom_order > b.custom_order) ? -1 : 1;
                        });
                        callback();
                    }
                });
            }
        ], function (error)
        {
            if (error)
            {
                var resErr = new Error(error);
                resErr.status = 503;
                return next(resErr);
            }
            else
            {
                res.locals.session.user = user;
                next();
            }
        });
    }
    else
    {
        next();
    }
}

function mergeGroupPermissions(currentPerms, newPerms, callback)
{
    for (var attr in currentPerms)
    {
        if (newPerms[attr] > currentPerms[attr])
            currentPerms[attr] = newPerms[attr];
    }
    return callback(currentPerms);
}

module.exports = {
    mergeGroupPermissions: mergeGroupPermissions,
    getPermissions: getPermissions
}