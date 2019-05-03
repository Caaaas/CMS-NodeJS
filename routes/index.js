var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var threadAccess = require.main.require('./utils/canViewThread');
var topicTags = require.main.require('./utils/getTags');
var logger = require.main.require('./utils/logger');

router.get('/', function (req, res, next)
{
    var forumNews = [];
    var forumPosts = [];

    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT forum_topics.*, " +
                        "u1.username AS topic_creator_username, " +
                        "u2.username AS topic_last_user_posted_username, " +
                        "g1.uag_group_id AS topic_creator_primary_group_id, " +
                        "c1.color AS topic_creator_primary_group_color, " +
                        "p1.post_content AS post_content " +
                        "FROM forum_topics " +
                        "INNER JOIN users u1 ON u1.user_id = forum_topics.topic_creator_id " +
                        "INNER JOIN users u2 ON u2.user_id = forum_topics.topic_last_user_posted_id " +
                        "INNER JOIN users_active_groups g1 ON g1.uag_user_id = forum_topics.topic_creator_id AND g1.uag_primary_group = 1 " +
                        "INNER JOIN user_groups c1 ON c1.group_id = g1.uag_group_id " +
                        "RIGHT JOIN forum_posts p1 ON p1.post_topic_id = forum_topics.topic_id " +
                        "WHERE topic_board_id = ? " +
                        "AND forum_topics.topic_hidden = 0 " +
                        "GROUP BY forum_topics.topic_id " +
                        "ORDER BY forum_topics.topic_id DESC " +
                        "LIMIT ?",
                        timeout: 30000,
                        values: [global.settings.news_board_id, global.settings.news_amount]
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
                            forumNews = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.each(forumNews, topicTags.getTags, function (error)
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                var count = 0;
                var offset = 0;
                var sql =
                    "SELECT " +
                    "forum_topics.*, " +
                    "b1.board_title AS board_title, " +
                    "u1.username AS topic_last_user_posted_username, " +
                    "u2.username AS topic_creator_username, " +
                    "p1.post_datetime AS topic_last_post_date";
                if (typeof req.session.user !== "undefined")
                {
                    sql = sql + ", r1.read_post_id AS user_last_read_post"
                }
                sql = sql +
                    " FROM forum_topics LEFT JOIN forum_boards b1 ON b1.board_id = forum_topics.topic_board_id " +
                    "LEFT JOIN users u1 ON u1.user_id = forum_topics.topic_last_user_posted_id " +
                    "LEFT JOIN users u2 ON u2.user_id = forum_topics.topic_creator_id " +
                    "LEFT JOIN forum_posts p1 ON p1.post_id = forum_topics.topic_last_post_id";
                if (typeof req.session.user !== "undefined")
                {
                    sql = sql + " LEFT JOIN forum_posts_read r1 ON r1.read_user_id = ? AND r1.read_topic_id = forum_topics.topic_id"
                }
                sql = sql + " WHERE forum_topics.topic_hidden = 0";
                if (typeof req.session.user !== "undefined")
                {
                    if (req.session.user.excluded_boards.length > 0)
                    {
                        sql = sql + " AND forum_topics.topic_board_id NOT IN (" + req.session.user.excluded_boards.join() + ")";
                    }
                    if (req.session.user.excluded_topics.length > 0)
                    {
                        sql = sql + " AND forum_topics.topic_id NOT IN (" + req.session.user.excluded_topics.join() + ")";
                    }
                }
                sql = sql + " ORDER BY topic_last_post_id DESC LIMIT 1 OFFSET ?";

                var valuesArray;
                async.whilst(
                    function ()
                    {
                        if ((count < global.settings.posts_amount) == false)
                        {
                            callback();
                        }
                        return (count < global.settings.posts_amount);
                    },
                    function (next)
                    {
                        if (typeof req.session.user !== "undefined")
                        {
                            valuesArray = [req.session.user.user_id, offset];
                        }
                        else
                        {
                            valuesArray = [offset];
                        }
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: sql,
                                timeout: 30000,
                                values: valuesArray
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
                                    if (results.length == 0)
                                    {
                                        count = global.settings.posts_amount;
                                        next();
                                    }
                                    else
                                    {
                                        threadAccess.canViewThread(results[0].topic_board_id, results[0].topic_id, userData, function (response)
                                        {
                                            if (response === false)
                                            {
                                                // Gör inget, den ska inte med!
                                                offset = offset + 1;
                                                next();
                                            }
                                            else
                                            {
                                                forumPosts.push(results[0]);
                                                count = count + 1;
                                                offset = offset + 1;
                                                next();
                                            }
                                        });
                                    }
                                }
                            });
                        });
                    }
                );
            },
            function (callback)
            {
                async.each(forumPosts, topicTags.getTags, function (error)
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
                        callback();
                    }
                });
            },
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras separat.
            }
            else
            {

                res.render('index', {
                    news: forumNews,
                    posts: forumPosts
                });

            }
        }
    )
})
;

module.exports = router;