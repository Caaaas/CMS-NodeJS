var express = require('express');
var router = express.Router();
var async = require("async");
var db = require.main.require('./utils/databases');
var logger = require.main.require('./utils/logger');

router.get('/*', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var userID;
    var userGroups;
    var profileUserData;

    var url = req.path.substr(1);
    var parts = url.split("/");

    if (url.substring(url.length - 1) === "/")
    {
        url = url.substring(0, url.length - 1);
    }

    async.series([
        function (callback)
        {
            if (parts.length < 1 || parts.length > 2)
            {
                var resErr = new Error();
                resErr.status = 404;
                next(resErr);
                return callback(true);
            }
            else
            {
                callback();
            }
        },
        function (callback)
        {
            if (parts[0].lastIndexOf("-") > -1)
            {
                userID = parseInt(parts[0].substr(parts[0].lastIndexOf("-") + 1, parts[0].length));
            }
            else
            {
                userID = parseInt(parts[0]);
            }

            if (typeof userID !== "number" || isNaN(userID))
            {
                logger.info("Försökte ange falska ID's för User profile's. User = " + JSON.stringify(req.session.user));
                var resErr = new Error();
                resErr.status = 503;
                next(resErr);
                return callback(true);
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
                    sql: "SELECT * FROM users WHERE user_id = ?",
                    timeout: 30000,
                    values: [userID]
                }, function (error, results)
                {
                    connection.release();
                    if (error)
                    {
                        logger.info(error);
                        var resErr = new Error();
                        resErr.status = 503;
                        next(resErr);
                        return callback(true);
                    }
                    else
                    {
                        profileUserData = results[0];
                        delete profileUserData.password;
                        callback();
                    }
                });
            });
        },
        function (callback)
        {
            db.getForumConnection(function (error, connection)
            {
                connection.query({
                    sql: "SELECT uag_group_id FROM users_active_groups WHERE uag_user_id = ?",
                    timeout: 30000,
                    values: [userID]
                }, function (error, results)
                {
                    connection.release();
                    if (error)
                    {
                        logger.info(error);
                        var resErr = new Error();
                        resErr.status = 503;
                        next(resErr);
                        return callback(true);
                    }
                    else
                    {
                        userGroups = results;
                        callback();
                    }
                });
            });
        },
        function (callback)
        {
                async.eachOf(userGroups, function (group, indexInner, nextInner)
                {
                    db.getForumConnection(function (indexInner, error, connection)
                    {
                        connection.query({
                            sql: "SELECT group_id, name, color, custom_order FROM user_groups WHERE group_id = ?",
                            timeout: 30000,
                            values: [group.uag_group_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return nextInner(true);
                            }
                            else
                            {
                                userGroups[indexInner] = results[0];
                                nextInner();
                            }
                        })
                    }.bind(db, indexInner));
                }, function (error)
                {
                    if (error)
                    {
                        logger.info(error);
                        var resErr = new Error();
                        resErr.status = 503;
                        next(resErr);
                        return callback(true);
                    }
                    else
                    {
                        userGroups.sort(function (a, b)
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
            // Gör inget, hanteras enskilt.
        }
        else
        {
            res.render('users', {
                session: req.session,
                user: profileUserData,
                groups: userGroups,
                chat: req.chat
            });
        }
    });
});

module.exports = router;