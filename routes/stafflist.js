var express = require('express');
var router = express.Router();
var async = require("async");
var db = require.main.require('./utils/databases');
var logger = require.main.require('./utils/logger');

router.get('/*', function (req, res, next)
{
    var users = [];
    var groups = [];
    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT group_id, name, color, custom_order FROM user_groups WHERE group_id IN (?) ORDER BY custom_order DESC",
                        timeout: 30000,
                        values: [global.settings.groups_in_staff]
                    }, function (error, results, fields)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            next(resErr);
                            return callback(true)
                        }
                        else
                        {
                            groups = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.map(groups, function (group, next)
                {
                    getUsersInGroup(group, function (error, result)
                    {
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            return next(resErr);
                        }
                        else
                        {
                            next(null, result);
                        }
                    })
                }, function (error, results)
                {
                    if (error)
                    {
                        return callback(error);
                    }
                    else
                    {
                        users = results;
                        callback();
                    }
                });
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras separat.
            }
            else
            {
                res.render('stafflist', {
                    groups: groups,
                    users: users
                });
            }
        });
});

function getUsersInGroup(group, callback)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT DISTINCT(uag_user_id) AS user_id, u1.username FROM users_active_groups LEFT JOIN users u1 ON u1.user_id = uag_user_id WHERE uag_group_id = ? AND uag_primary_group = 1",
            timeout: 30000,
            values: [group.group_id]
        }, function (error, results, fields)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                var resErr = new Error();
                resErr.status = 503;
                return callback(true)
            }
            else
            {
                async.each(results, getAllUserGroups, function (error)
                {
                    if (error)
                    {
                        logger.info(error);
                        var resErr = new Error();
                        resErr.status = 503;
                        return callback(true)
                    }
                    else
                    {
                        callback(false, results);
                    }
                });
            }
        });
    });
}

function getAllUserGroups(user, callback)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql:
                "SELECT DISTINCT(uag_group_id) AS group_id, " +
                "g1.custom_order, " +
                "g1.name, " +
                "g1.color " +
                "FROM users_active_groups " +
                "LEFT JOIN user_groups g1 ON g1.group_id = uag_group_id " +
                "WHERE uag_user_id = ? " +
                "ORDER BY g1.custom_order DESC",
            timeout: 30000,
            values: [user.user_id]
        }, function (error, results, fields)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                var resErr = new Error();
                resErr.status = 503;
                return callback(true)
            }
            else
            {
                user.groups = results;
                callback();
            }
        });
    });
}

/*
function getUsersInGroup(group, callback)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT DISTINCT(uag_user_id) AS user_id FROM users_active_groups WHERE uag_group_id = ? AND uag_primary_group = 1",
            timeout: 30000,
            values: [group.group_id]
        }, function (error, results, fields)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                var resErr = new Error();
                resErr.status = 503;
                return callback(true)
            }
            else
            {
                group.users = results;
                callback(null, results);
            }
        });
    });
}
 */

module.exports = router;