var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var functions = require.main.require('./utils/functions/topic');
var functionsGeneral = require.main.require('./utils/functions/general');
var topicAccess = require.main.require('./utils/canViewThread');
var logger = require.main.require('./utils/logger');

router.post('/', function (req, res, next)
{
    var content = req.body.content.trim();
    content = content.replace(/'/g, '&#39;');
    var topicID = parseInt(req.body.topic_id.trim());
    var postData;
    var directory;
    var subBoard = 0;

    var creationDate = new Date();

    var new_post_id = 0;

    var returnObject = {};

    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    if (typeof topicID !== "number" || isNaN(topicID))
    {
        logger.info("Försökte ange falska ID's för Posts's i postskapande. User = " + req.session.user);
        res.sendStatus(503);
    }
    else if (userData == null)
    {
        logger.info("Försökre skapa post, inte inloggad.");
        res.sendStatus(503);
    }
    else
    {
        async.series([
                function (callback)
                {
                    if (!content || content.length <= 0 || content === "<p><br></p>")
                    {
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
                            sql: "SELECT topic_board_id, " +
                            "topic_locked, " +
                            "topic_hidden, " +
                            "topic_creator_id, " +
                            "topic_creation_date, " +
                            "topic_title, " +
                            "b1.board_locked, " +
                            "b1.board_sub_board_to " +
                            "FROM forum_topics " +
                            "LEFT JOIN " +
                            "forum_boards b1 ON b1.board_id = topic_board_id " +
                            "WHERE topic_id = ?",
                            timeout: 30000,
                            values: [topicID]
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
                                if (results.length != 1)
                                {
                                    logger.info("Försöker skapa en post i en tråd som inte finns. User = " + req.session.user);
                                    res.sendStatus(404);
                                    return callback(true);
                                }
                                else
                                {
                                    postData = results[0];
                                    subBoard = parseInt(results[0].board_sub_board_to);
                                    callback();
                                }
                            }
                        });
                    });
                },
                function (callback)
                {
                    topicAccess.canViewThread(postData.topic_board_id, topicID, userData, function (response)
                    {
                        if (response === false)
                        {
                            logger.info("Försöker skapa en post i en tråd de ej har access till. User = " + req.session.user);
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
                    functions.canCreatePost(userData, topicID, postData, function (response)
                    {
                        if (response == false)
                        {
                            // Får inte skapa
                            logger.info("Försöker skapa en post då user saknar permissions. User = " + req.session.user);
                            res.sendStatus(403);
                            return callback(true);
                        }
                        else
                        {
                            // Får skapa
                            callback();
                        }
                    })
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
                            values: [topicID, userData.user_id, creationDate, content]
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
                            sql: 'UPDATE forum_topics SET topic_posts = topic_posts + 1, topic_last_post_id = ?, topic_last_user_posted_id = ? WHERE topic_id = ?',
                            timeout: 30000,
                            values: [new_post_id, userData.user_id, topicID]
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
                            values: [userData.user_id]
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
                                    'board_posts = board_posts + 1 ' +
                                    'WHERE board_id = ?',
                                timeout: 30000,
                                values: [topicID, postData.topic_board_id]
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
                                                    postData.topic_board_id = subBoard;
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
                    returnObject.code = 200;
                    returnObject.url = encodeURIComponent(functionsGeneral.customURLEncode(postData.topic_title)) + "-" + new_post_id;
                    res.send(returnObject);
                }
            }
        );
    }
});

module.exports = router;