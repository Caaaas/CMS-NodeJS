var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var functions = require.main.require('./utils/functions/topic');
var functionsGeneral = require.main.require('./utils/functions/general');
var threadAccess = require.main.require('./utils/canViewThread');
var logger = require.main.require('./utils/logger');

router.post('/', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var title = req.body.title.trim();
    var content = req.body.content.trim();
    content = content.replace(/'/g, '&#39;');
    var tags = req.body.tags;
    var postID = parseInt(req.body.post_id.trim());

    var postData;
    var directory;

    var editPost = false;
    var editTopic = false;

    var firstPostID = false;

    var returnObject = {};

    if (typeof postID !== "number" || isNaN(postID))
    {
        logger.info("Försökte ange falska ID's för Tråd's i trådeditande. User = " + req.session.user);
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
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "" +
                            "SELECT " +
                            "post_topic_id, " +
                            "post_user_id, " +
                            "post_hidden, " +
                            "post_datetime, " +
                            "post_content, " +
                            "t1.topic_board_id AS topic_board_id, " +
                            "t1.topic_creator_id AS topic_creator_id, " +
                            "t1.topic_locked AS topic_locked, " +
                            "t1.topic_hidden AS topic_hidden, " +
                            "t1.topic_title AS topic_title, " +
                            "b1.board_locked AS board_locked " +
                            "FROM forum_posts " +
                            "LEFT JOIN " +
                            "forum_topics t1 ON t1.topic_id = post_topic_id " +
                            "LEFT JOIN " +
                            "forum_boards b1 ON b1.board_id = t1.topic_board_id " +
                            "WHERE post_id = ?",
                            timeout: 30000,
                            values: [postID]
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
                                if (results.length !== 1)
                                {
                                    logger.info("Försöker edita en tråd som inte finns. User = " + req.session.user);
                                    res.sendStatus(404);
                                    return callback(true);
                                }
                                else
                                {
                                    postData = results[0];
                                    callback();
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
                            sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? ORDER BY post_id ASC LIMIT 1",
                            timeout: 30000,
                            values: [postData.post_topic_id]
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
                                firstPostID = results[0].post_id;
                                callback();
                            }
                        });
                    });
                },
                function (callback)
                {
                    threadAccess.canViewThread(postData.topic_board_id, postData.post_topic_id, userData, function (response)
                    {
                        if (response === false)
                        {
                            logger.info("Försöker edita en post de ej har access till. User = " + req.session.user);
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
                    functions.canEditTopic(userData, postID, postData, function (response)
                    {
                        if (response === false || !firstPostID)
                        {
                            editTopic = false;
                            callback();
                        }
                        else
                        {
                            editTopic = true;
                            callback();
                        }
                    });
                },
                function (callback)
                {
                    functions.canEditPost(userData, postID, postData, function (response)
                    {
                        if (response === false)
                        {
                            editPost = false;
                            callback();
                        }
                        else
                        {
                            editPost = true;
                            callback();
                        }
                    });
                },
                function (callback)
                {
                    if (editTopic)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'UPDATE forum_topics SET topic_title = ? WHERE topic_id = ?',
                                timeout: 30000,
                                values: [title, postData.post_topic_id]
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
                },
                function (callback)
                {
                    if (editPost)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'UPDATE forum_posts SET post_content = ? WHERE post_id = ?',
                                timeout: 30000,
                                values: [content, postID]
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
                },
                function (callback)
                {
                    if (editTopic)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'DELETE FROM forum_topics_tags WHERE ftt_topic_id = ?',
                                timeout: 30000,
                                values: [postData.post_topic_id]
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
                },
                function (callback)
                {
                    if (editTopic)
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
                                                        values: [postData.post_topic_id, tagID]
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
                    else
                    {
                        callback();
                    }
                }
            ],
            function (error)
            {
                if (error)
                {
                    // Hanteras separat
                }
                else
                {
                    returnObject.code = 200;
                    returnObject.url = encodeURIComponent(functionsGeneral.customURLEncode(title)) + "-" + postID;
                    res.send(returnObject);
                }
            }
        );
    }
});

router.get('/*', function (req, res, next)
{
    var returnObj = {};

    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var url = req.path.substr(1);
    var parts = url.split("/");
    parts[1] = parseInt(parts[1]);

    var boardID;
    var boardLocked;
    var directory = null;

    var postID;
    var postData;

    var editPost = false;
    var editTopic = false;

    var currentTags = [];
    var allTags = [];

    if (userData == null)
    {
        logger.info("Försökte edita en post då denne ej är inloggad... User = " + req.session);
        var resErr = new Error();
        resErr.status = 403;
        next(resErr);
    }
    else
    {
        if (parts.length > 2 || parts.length < 1)
        {
            var resErr = new Error();
            resErr.status = 404;
            next(resErr);
        }
        else
        {
            if (parts[0].lastIndexOf("-") > -1)
            {
                postID = parseInt(parts[0].substr(parts[0].lastIndexOf("-") + 1, parts[0].length));
            }
            else
            {
                postID = parseInt(parts[0]);
            }

            // Vi har nu boardID't, om det stämmer gå vidare, annars 404!
            if (typeof postID !== "number" || isNaN(postID))
            {
                logger.info("Försökte ange falska ID's för Post's i trådskapande. User = " + req.session.user);
                var resErr = new Error();
                resErr.status = 503;
                next(resErr);
            }
            else
            {
                async.series([
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "" +
                                "SELECT " +
                                "post_topic_id, " +
                                "post_user_id, " +
                                "post_hidden, " +
                                "post_datetime, " +
                                "post_content, " +
                                "t1.topic_board_id AS topic_board_id, " +
                                "t1.topic_creator_id AS topic_creator_id, " +
                                "t1.topic_locked AS topic_locked, " +
                                "t1.topic_hidden AS topic_hidden, " +
                                "t1.topic_title AS topic_title, " +
                                "b1.board_locked AS board_locked " +
                                "FROM forum_posts " +
                                "LEFT JOIN " +
                                "forum_topics t1 ON t1.topic_id = post_topic_id " +
                                "LEFT JOIN " +
                                "forum_boards b1 ON b1.board_id = t1.topic_board_id " +
                                "WHERE post_id = ?",
                                timeout: 30000,
                                values: [postID]
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
                                    if (results.length !== 1)
                                    {
                                        logger.info("Försöker edita en tråd som inte finns. User = " + JSON.stringify(req.session.user));
                                        var resErr = new Error();
                                        resErr.status = 404;
                                        next(resErr);
                                        return callback(true);
                                    }
                                    else
                                    {
                                        postData = results[0];
                                        callback();
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
                                sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? ORDER BY post_id ASC LIMIT 1",
                                timeout: 30000,
                                values: [postData.post_topic_id]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Hittar inte första posten, skumt! = " + JSON.stringify(req.session.user));
                                    var resErr = new Error();
                                    resErr.status = 404;
                                    next(resErr);
                                    return callback(true);
                                }
                                else
                                {
                                    if (results[0].post_id == postID)
                                    {
                                        postData.firstPost = true;
                                        callback();
                                    }
                                    else
                                    {
                                        postData.firstPost = false;
                                        callback();
                                    }
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        threadAccess.canViewThread(postData.topic_board_id, postData.post_topic_id, userData, function (response)
                        {
                            if (response === false)
                            {
                                logger.info("Försöker edita en post de ej har access till. User = " + JSON.stringify(req.session.user));
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
                        functions.canEditTopic(userData, postID, postData, function (response)
                        {
                            if (response === false || !postData.firstPost)
                            {
                                editTopic = false;
                                callback();
                            }
                            else
                            {
                                editTopic = true;
                                callback();
                            }
                        });
                    },
                    function (callback)
                    {
                        functions.canEditPost(userData, postID, postData, function (response)
                        {
                            if (response === false)
                            {
                                editPost = false;
                                callback();
                            }
                            else
                            {
                                editPost = true;
                                callback();
                            }
                        });
                    },
                    function (callback)
                    {
                        if (!editTopic && !editPost)
                        {
                            logger.info("Försöker edita en post de ej har access till. User = " + JSON.stringify(req.session.user));
                            var resErr = new Error();
                            resErr.status = 403;
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
                                sql: "" +
                                "SELECT *, " +
                                "t1.ftt_tag_id, " +
                                "t1.ftt_topic_id " +
                                "FROM " +
                                "forum_tags " +
                                "INNER JOIN " +
                                "forum_topics_tags t1 ON t1.ftt_tag_id = tag_id AND t1.ftt_topic_id = ?",
                                timeout: 30000,
                                values: [postData.post_topic_id]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    callback();
                                }
                                else
                                {
                                    async.forEachOf(results, function (value, key, callback)
                                    {
                                        delete value.ftt_id;
                                        delete value.ftt_topic_id;
                                        delete value.ftt_tag_id;
                                        callback();
                                    }, function (error)
                                    {
                                        if (error)
                                        {
                                            logger.info(error);
                                            callback();
                                        }
                                        else
                                        {
                                            currentTags = results;
                                            callback();
                                        }
                                    });
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT * FROM forum_tags WHERE tag_active = 1",
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
                                    allTags = results;
                                    callback();
                                }
                            });
                        });
                    }
                ], function (error)
                {
                    if (error)
                    {
                        // Hanteras separat.
                    }
                    else
                    {
                        res.render('topic_edit', {
                            session: req.session,
                            currentPost: postID,
                            editPost: editPost,
                            editTopic: editTopic,
                            directory: directory,
                            allTags: allTags,
                            currentTags: currentTags,
                            title: postData.topic_title,
                            content: postData.post_content,
                            chat: req.chat
                        });
                    }
                });
            }
        }
    }
});

module.exports = router;