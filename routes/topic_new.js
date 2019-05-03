var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var functions = require.main.require('./utils/functions/topic');
var functionsGeneral = require.main.require('./utils/functions/general');
var forumAccess = require.main.require('./utils/canViewForum');
var logger = require.main.require('./utils/logger');

router.post('/', function (req, res, next)
{
    var title = req.body.title.trim();
    var content = req.body.content.trim();
    content = content.replace(/'/g, '&#39;');
    var tags = req.body.tags;

    var boardID = parseInt(req.body.board_id.trim());
    var subBoard = 0;

    var creationDate = new Date();
    var new_topic_id = 0;
    var new_post_id = 0;
    var directory;

    var boardLocked = 1;

    var returnObject = {};

    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    if (typeof boardID !== "number" || isNaN(boardID))
    {
        logger.info("Försökte ange falska ID's för Board's i trådskapande. User = " + req.session.user);
        res.sendStatus(503);
    }
    else if (userData == null)
    {
        logger.info("Försökre stickya tråd, inte inloggad.");
        res.sendStatus(503);
    }
    else
    {
        async.series([
                function (callback)
                {
                    if (!title || title.length <= 0 || !content || content.length <= 0 || content === "<p><br></p>")
                    {
                        if (title.length <= 0)
                        {
                            returnObject.title = "Du måste ange en titel."
                        }
                        if (content.length <= 0 || content === "<p><br></p>")
                        {
                            returnObject.content = "Ditt inlägg får inte vara tomt."
                        }

                        res.send(returnObject);
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                },
                function (callback)
                {
                    forumAccess.canViewForum(boardID, userData, function (response)
                    {
                        if (response === false)
                        {
                            logger.info("Försöker skapa en tråd i ett forum de ej har access till. Board = " + boardID + " User = " + req.session.user);
                            res.sendStatus(403);
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
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: 'SELECT board_locked, board_sub_board_to FROM forum_boards WHERE board_id = ?',
                            timeout: 30000,
                            values: [boardID]
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
                                boardLocked = parseInt(results[0].board_locked);
                                subBoard = parseInt(results[0].board_sub_board_to);
                                callback();
                            }
                        });
                    });
                },
                function (callback)
                {
                    if (req.session.user.permissions.topic_new && (req.session.user.permissions.board_lock || !boardLocked))
                    {
                        callback();
                    }
                    else
                    {
                        logger.info("Försöker skapa en tråd då de ej har permissions. User = " + req.session.user);
                        res.sendStatus(403);
                        return callback(true);
                    }
                },
                function (callback)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: 'INSERT INTO forum_topics SET ' +
                            'topic_board_id = ?, ' +
                            'topic_title = ?, ' +
                            'topic_creator_id = ?, ' +
                            'topic_creation_date = ?, ' +
                            'topic_last_user_posted_id = ?, ' +
                            'topic_posts = ?',
                            timeout: 30000,
                            values: [
                                boardID,
                                title,
                                req.session.user.user_id,
                                creationDate,
                                req.session.user.user_id,
                                1
                            ]
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
                                new_topic_id = results.insertId;
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
                            sql: 'INSERT INTO forum_posts SET ' +
                            'post_topic_id = ?, ' +
                            'post_user_id = ?, ' +
                            'post_datetime = ?, ' +
                            'post_content = ?',
                            timeout: 30000,
                            values: [
                                new_topic_id,
                                req.session.user.user_id,
                                creationDate,
                                content
                            ]
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
                                new_post_id = results.insertId;
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
                            sql: 'UPDATE forum_topics SET topic_last_post_id = ? WHERE topic_id = ?',
                            timeout: 30000,
                            values: [new_post_id, new_topic_id]
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
                            sql: 'UPDATE users SET user_total_topics = user_total_topics + 1 WHERE user_id = ?',
                            timeout: 30000,
                            values: [req.session.user.user_id]
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
                            sql: 'UPDATE users SET user_total_posts = user_total_posts + 1 WHERE user_id = ?',
                            timeout: 30000,
                            values: [req.session.user.user_id]
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
                                callback();
                            }
                        });
                    });
                },
                function (callback)
                {
                    updateBoardCount();
                    function updateBoardCount()
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'UPDATE forum_boards SET ' +
                                'board_last_topic_id = ?, ' +
                                'board_topics = board_topics + 1,' +
                                'board_posts = board_posts + 1 ' +
                                'WHERE board_id = ?',
                                timeout: 30000,
                                values: [
                                    new_topic_id,
                                    boardID
                                ]
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
                                    if (subBoard > 0)
                                    {
                                        db.getForumConnection(function (err, connection)
                                        {
                                            connection.query({
                                                sql: 'SELECT board_sub_board_to FROM forum_boards WHERE board_id = ?',
                                                timeout: 30000,
                                                values: [subBoard]
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
                                                    boardID = subBoard;
                                                    subBoard = parseInt(results[0].board_sub_board_to);
                                                    updateBoardCount();
                                                }
                                            });
                                        });
                                    }
                                    else
                                    {
                                        callback();
                                    }
                                }
                            });
                        });
                    }
                },
                function (callback)
                {
                    if (tags.length > 0)
                    {
                        async.each(tags, insertTag, function (error)
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
                    }
                    else
                    {
                        callback();
                    }

                    function insertTag(tag, callback)
                    {
                        var tagID;
                        if (tag.lastIndexOf("-") > -1)
                        {
                            tagID = parseInt(tag.substr(tag.lastIndexOf("-") + 1, tag.length));
                        }
                        else
                        {
                            tagID = parseInt(tag);
                        }

                        // Vi har nu boardID't, om det stämmer gå vidare, annars 404!
                        if (typeof tagID !== "number" || isNaN(tagID))
                        {
                            logger.info("Försöker skicka med falska tags = " + req.session.user);
                            res.sendStatus(503);
                            return callback(true);
                        }
                        else
                        {
                            db.getForumConnection(function (err, connection)
                            {
                                connection.query({
                                    sql: 'SELECT COUNT(*) AS count FROM forum_tags WHERE tag_id = ?',
                                    timeout: 30000,
                                    values: [tagID]
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
                                        if (results[0].count > 0)
                                        {
                                            db.getForumConnection(function (err, connection)
                                            {
                                                connection.query({
                                                    sql: 'INSERT INTO forum_topics_tags SET ftt_topic_id = ?, ftt_tag_id = ?',
                                                    timeout: 30000,
                                                    values: [new_topic_id, tagID]
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
                                                        callback();
                                                    }
                                                });
                                            });
                                        }
                                        else
                                        {
                                            callback();
                                        }
                                    }
                                });
                            });
                        }
                    }
                }
            ],
            function (error)
            {
                if (error)
                {

                }
                else
                {
                    returnObject.code = 200;
                    returnObject.url = encodeURIComponent(functionsGeneral.customURLEncode(title)) + "-" + new_topic_id;
                    res.send(returnObject);
                }
            }
        );
    }
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

    parts[1] = parseInt(parts[1]);

    var boardID;
    var boardLocked = 1;
    var directory = null;
    var url = req.path.substr(1);

    if (url.substring(url.length - 1) === "/")
    {
        url = url.substring(0, url.length - 1);
    }

    var parts = url.split("/");
    var boardID;
    var tags = [];

    if (typeof req.session.user === "undefined")
    {
        logger.info("Försökte skapa tråd då denne ej är inloggad... User = " + JSON.stringify(req.session.user));
        var resErr = new Error();
        resErr.status = 403;
        next(resErr);
    }
    else
    {
        if (parts.length !== 1)
        {
            res.sendStatus(404);
        }
        else
        {
            if (parts[0].lastIndexOf("-") > -1)
            {
                boardID = parseInt(parts[0].substr(parts[0].lastIndexOf("-") + 1, parts[0].length));
            }
            else
            {
                boardID = parseInt(parts[0]);
            }

            // Vi har nu boardID't, om det stämmer gå vidare, annars 404!
            if (typeof boardID !== "number" || isNaN(boardID))
            {
                logger.info("Försökte ange falska ID's för Board's i trådskapande. User = " + JSON.stringify(req.session.user));
                var resErr = new Error();
                resErr.status = 503;
                next(resErr);
            }
            else
            {
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
                                sql: "SELECT board_id FROM forum_boards WHERE board_id = ?",
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
                                        logger.info("Försöker skapa en tråd i en forum-board som inte finns. User = " + JSON.stringify(req.session.user));
                                        var resErr = new Error();
                                        resErr.status = 404;
                                        next(resErr);
                                        return callback(true);
                                    }
                                    else
                                    {
                                        boardID = results[0].board_id;
                                        callback();
                                    }
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        var userData;
                        if (typeof req.session.user !== 'undefined')
                            userData = req.session.user;
                        else
                            userData = null;

                        forumAccess.canViewForum(boardID, userData, function (response)
                        {
                            if (response === false)
                            {
                                logger.info("Försöker skapa en tråd i ett forum de ej har access till. User = " + JSON.stringify(req.session.user));
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
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'SELECT board_locked FROM forum_boards WHERE board_id = ?',
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
                                    boardLocked = parseInt(results[0].board_locked);
                                    callback();
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        if (req.session.user.permissions.topic_new && (req.session.user.permissions.board_lock || !boardLocked))
                        {
                            callback();
                        }
                        else
                        {
                            logger.info("Försöker skapa en tråd då de saknar dem permissionsen. User = " + JSON.stringify(req.session.user));
                            var resErr = new Error();
                            resErr.status = 403;
                            next(resErr);
                            return callback(true);
                        }
                    },
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT * FROM forum_tags",
                                timeout: 30000
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    return callback([]);
                                }
                                else
                                {
                                    tags = results;
                                    callback();
                                }
                            });
                        });
                    },
                ], function (error)
                {
                    if (error)
                    {
                        // Hanteras separat.
                    }
                    else
                    {
                        res.render('topic_new', {
                            session: req.session,
                            currentBoard: boardID,
                            directory: directory,
                            tags: tags,
                            chat: req.chat
                        });
                    }
                });
            }
        }
    }
});

module.exports = router;