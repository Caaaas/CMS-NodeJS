var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var mysql = require('mysql');
var async = require('async');
var forumAccess = require.main.require('./utils/canViewForum');
var logger = require.main.require('./utils/logger');
var topicTags = require.main.require('./utils/getTags');
var paginator = require('paginator');

router.get('/', function (req, res, next)
{
    var boards;
    var categories;

    async.series([
        function (callback)
        {
            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql: "SELECT * FROM forum_categories",
                    timeout: 30000
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
                        categories = results;

                        categories.sort(function (a, b)
                        {
                            return (a.category_custom_order < b.category_custom_order) ? -1 : 1;
                        });

                        callback();
                    }
                });
            });
        },
        function (callback)
        {
            var sql = "";
            if (typeof req.session.user !== 'undefined')
            {
                var userGroupsSQL = "";
                var userGroups = [];

                for (var i = 0; i < req.session.user.groups.length; i++)
                {
                    userGroups.push(req.session.user.groups[i].group_id);
                }

                for (var i = 0; i < userGroups.length; i++)
                {
                    var temp = " OR board_user_groups_can_view LIKE '%-" + userGroups[i] + "-%'";
                    userGroupsSQL += temp;
                }
                sql = "SELECT forum_boards.*, " +
                    "t1.topic_title AS board_last_topic_title, " +
                    "t1.topic_creator_id AS board_last_topic_user_id, " +
                    "u1.username AS board_last_topic_username " +
                    "FROM forum_boards " +
                    "LEFT JOIN forum_topics t1 ON t1.topic_id = board_last_topic_id " +
                    "LEFT JOIN users u1 ON u1.user_id = t1.topic_creator_id " +
                    "WHERE (board_user_groups_can_view = 0" + userGroupsSQL + ")";
            }
            else
            {
                sql = "SELECT forum_boards.*, " +
                    "t1.topic_title AS board_last_topic_title, " +
                    "t1.topic_creator_id AS board_last_topic_user_id, " +
                    "u1.username AS board_last_topic_username " +
                    "FROM forum_boards " +
                    "LEFT JOIN forum_topics t1 ON t1.topic_id = board_last_topic_id " +
                    "LEFT JOIN users u1 ON u1.user_id = t1.topic_creator_id " +
                    "WHERE board_user_groups_can_view = 0";
            }

            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql: sql,
                    timeout: 30000
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
                        boards = results;

                        boards.sort(function (a, b)
                        {
                            return (a.board_custom_order < b.board_custom_order) ? -1 : 1;
                        });

                        callback();
                    }
                });
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
            res.render('forum', {
                session: req.session,
                chat: req.chat,
                categories: categories,
                boards: boards
            });
        }
    });
});

router.get('/*', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var url = req.path.substr(1);
    var parts = url.split("/");
    var boardPage = 0;
    var pageInfo;

    var offset;
    var topics;
    var boards;
    var lastPage = 1;
    var directory = null;
    var url = req.path.substr(1);

    if (url.substring(url.length - 1) === "/")
    {
        url = url.substring(0, url.length - 1);
    }

    var parts = url.split("/");
    var boardID;
    var boardTitle;
    var boardLocked;

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
                boardID = parseInt(parts[0].substr(parts[0].lastIndexOf("-") + 1, parts[0].length));
            }
            else
            {
                boardID = parseInt(parts[0]);
            }

            if (typeof boardID !== "number" || isNaN(boardID))
            {
                logger.info("Försökte ange falska ID's för Board's. User = " + JSON.stringify(req.session.user));
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
            if (parts.length === 2)
            {
                if (parts[1].lastIndexOf("-") > -1)
                {
                    boardPage = parseInt(parts[1].substr(parts[1].lastIndexOf("-") + 1, parts[1].length)) - 1;
                }
                else
                {
                    boardPage = parseInt(parts[1]) - 1;
                }

                if (typeof boardPage !== "number" || isNaN(boardPage) || boardPage < 0)
                {
                    logger.info("Försökte ange falska ID's för Board's. User = " + JSON.stringify(req.session.user));
                    var resErr = new Error();
                    resErr.status = 503;
                    next(resErr);
                    return callback(true);
                }
                else
                {
                    callback();
                }
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
                    sql: "SELECT board_id, board_title, board_locked FROM forum_boards WHERE board_id = ?",
                    timeout: 30000,
                    values: [boardID]
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
                        if (results.length != 1)
                        {
                            logger.info("Försökte hämta en board som inte finns. User = " + JSON.stringify(req.session.user));
                            var resErr = new Error();
                            resErr.status = 404;
                            next(resErr);
                            return callback(true);
                        }
                        else
                        {
                            boardID = results[0].board_id;
                            boardTitle = results[0].board_title;
                            boardLocked = results[0].board_locked;
                            callback();
                        }
                    }
                });
            });
        },
        function (callback)
        {
            forumAccess.canViewForum(boardID, userData, function (response)
            {
                if (response === false)
                {
                    logger.info("Försöker komma åt en sida de ej har access till. User = " + JSON.stringify(req.session.user));
                    var resErr = new Error();
                    resErr.status = 403;
                    next(resErr);
                    return callback(true);
                }
                else
                {
                    directory = response;
                    callback();
                }
            });
        },
        function (callback)
        {
            var sql = "";
            if (userData !== null)
            {
                var userGroupsSQL = "";
                var userGroups = [];

                for (var i = 0; i < req.session.user.groups.length; i++)
                {
                    userGroups.push(req.session.user.groups[i].group_id);
                }

                for (var i = 0; i < userGroups.length; i++)
                {
                    var temp = " OR board_user_groups_can_view LIKE '%-" + userGroups[i] + "-%'";
                    userGroupsSQL += temp;
                }
                sql = "SELECT forum_boards.*, " +
                    "t1.topic_title AS board_last_topic_title, " +
                    "t1.topic_creator_id AS board_last_topic_user_id, " +
                    "u1.username AS board_last_topic_username " +
                    "FROM forum_boards " +
                    "LEFT JOIN forum_topics t1 ON t1.topic_id = board_last_topic_id " +
                    "LEFT JOIN users u1 ON u1.user_id = t1.topic_creator_id " +
                    "WHERE (board_id = " + mysql.escape(boardID) + " OR board_sub_board_to = " + mysql.escape(boardID) + ") AND (board_user_groups_can_view = 0" + userGroupsSQL + ")";
            }
            else
            {
                sql = "SELECT forum_boards.*, " +
                    "t1.topic_title AS board_last_topic_title, " +
                    "t1.topic_creator_id AS board_last_topic_user_id, " +
                    "u1.username AS board_last_topic_username " +
                    "FROM forum_boards " +
                    "LEFT JOIN forum_topics t1 ON t1.topic_id = board_last_topic_id " +
                    "LEFT JOIN users u1 ON u1.user_id = t1.topic_creator_id " +
                    "WHERE (board_id = " + mysql.escape(boardID) + " OR board_sub_board_to = " + mysql.escape(boardID) + ") AND board_user_groups_can_view = 0";
            }

            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql: sql,
                    timeout: 30000
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
                        boards = results;
                        if (boards.length > 0)
                        {
                            boards.sort(function (a, b)
                            {
                                return (a.board_custom_order < b.board_custom_order) ? -1 : 1;
                            });

                            callback();
                        }
                        else
                        {
                            logger.info("Försökte hämta flera boards som inte finns. User = " + JSON.stringify(req.session.user));
                            var resErr = new Error();
                            resErr.status = 404;
                            next(resErr);
                            return callback(true);
                        }
                    }
                });
            });
        },
        function (callback)
        {
            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql: "SELECT COUNT(*) as count FROM forum_topics WHERE topic_board_id = ?",
                    timeout: 30000,
                    values: [boardID]
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
                        lastPage = parseInt(results[0].count / global.settings.topics_per_page);
                        callback();
                    }
                });
            });
        },
        function (callback)
        {
            offset = global.settings.topics_per_page * boardPage;

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
                " FROM forum_topics " +
                "LEFT JOIN forum_boards b1 ON b1.board_id = forum_topics.topic_board_id " +
                "LEFT JOIN users u1 ON u1.user_id = forum_topics.topic_last_user_posted_id " +
                "LEFT JOIN users u2 ON u2.user_id = forum_topics.topic_creator_id " +
                "LEFT JOIN forum_posts p1 ON p1.post_id = forum_topics.topic_last_post_id";
            if (typeof req.session.user !== "undefined")
            {
                sql = sql + " LEFT JOIN forum_posts_read r1 ON r1.read_user_id = ? AND r1.read_topic_id = forum_topics.topic_id"
            }
            sql = sql + " WHERE topic_board_id = ? AND forum_topics.topic_hidden = 0 ORDER BY topic_sticky DESC, topic_last_post_id DESC LIMIT ? OFFSET ?";

            var values = [];

            if (typeof req.session.user === "undefined")
            {
                values = [boardID, global.settings.topics_per_page, offset];
            }
            else
            {
                values = [userData.user_id, boardID, global.settings.topics_per_page, offset];
            }

            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql: sql,
                    timeout: 30000,
                    values: values
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
                        topics = results;
                        callback();
                    }
                });
            });
        },
        function (callback)
        {
            async.each(topics, topicTags.getTags, function (error)
            {
                if (error)
                {
                    logger.info(error);
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
            if (topics.length == 0)
            {
                callback();
            }
            else
            {
                var separateCount = 0;
                for (var i = 0; i < topics.length; i++)
                {
                    db.getForumConnection(function (i, err, connection)
                    {
                        connection.query({
                            sql: "SELECT username FROM users WHERE user_id = ?",
                            timeout: 30000,
                            values: [topics[i].topic_creator_id]
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
                                topics[i].topic_creator_username = results[0].username;
                                separateCount = separateCount + 1;
                                if (separateCount == topics.length)
                                {
                                    callback();
                                }
                            }
                        });
                    }.bind(db, i));
                }
            }
        },
        function (callback)
        {
            if (topics.length == 0)
            {
                callback();
            }

            var separateCount = 0;
            for (var i = 0; i < topics.length; i++)
            {
                db.getForumConnection(function (i, err, connection)
                {
                    connection.query({
                        sql: "SELECT username FROM users WHERE user_id = ?",
                        timeout: 30000,
                        values: [topics[i].topic_last_user_posted_id]
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
                            topics[i].topic_last_user_posted_username = results[0].username;
                            separateCount = separateCount + 1;

                            if (separateCount == topics.length)
                            {
                                callback();
                            }
                        }
                    });
                }.bind(db, i));
            }
        },
        function (callback)
        {
            var pages = new paginator(global.settings.topics_per_page, 5);
            pageInfo = pages.build(lastPage * global.settings.topics_per_page, boardPage + 1);
            callback();
        }
    ], function (error)
    {
        if (error)
        {
            // Gör inget, hanteras enskilt.
        }
        else
        {
            res.render('forum', {
                session: req.session,
                chat: req.chat,
                boards: boards,
                currentBoard: boardID,
                currentBoardTitle: boardTitle,
                boardLocked: boardLocked,
                topics: topics,
                currentPage: boardPage + 1,
                lastPage: lastPage,
                directory: directory,
                paginator: pageInfo
            });
        }
    });
});

module.exports = router;