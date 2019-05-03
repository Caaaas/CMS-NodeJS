var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var threadAccess = require.main.require('./utils/canViewThread');
var logger = require.main.require('./utils/logger');

router.post('/', function (req, res, next)
{
    var postID = req.body.postId.trim();
    var reactionType = req.body.reactionType.trim();

    var userData;
    var postData = {};
    var increase = null;
    if (!postID || !reactionType)
    {
        logger.info("Försöker skicka reactions utan att skicka med data.");
        res.sendStatus(503);
    }
    else
    {
        async.series([
                function (callback)
                {
                    if (typeof req.session.user !== 'undefined')
                    {
                        userData = req.session.user;
                        callback();
                    }
                    else
                    {
                        logger.info("Försöker skicka reactions utan att ha access.");
                        res.sendStatus(403);
                        return callback(true);
                    }
                },
                function (callback)
                {
                    if (postID.indexOf("-") > -1)
                    {
                        postID = parseInt(postID.substr(postID.indexOf("-") + 1, postID.length));
                    }
                    else
                    {
                        postID = parseInt(postID);
                    }

                    if (typeof postID === 'number' && (postID % 1) === 0)
                    {

                        callback();
                    }
                    else
                    {
                        logger.info("Försöker skicka reactions giltigt POSTID.");
                        res.sendStatus(403);
                        return callback(true);
                    }
                },
                function (callback)
                {
                    if (reactionType == "like" || reactionType == "agree" || reactionType == "insightful" || reactionType == "promote")
                    {
                        var reactionTypePermission = "reactions_" + reactionType;
                        if (userData.permissions[reactionTypePermission] === 1)
                        {
                            callback();
                        }
                        else
                        {
                            logger.info("Försöker skicka reactions utan permission för den.");
                            res.sendStatus(403);
                            return callback(true);
                        }
                    }
                    else
                    {
                        logger.info("Försöker skicka reactions utan giltig ReactionType.");
                        res.sendStatus(403);
                        return callback(true);
                    }
                },
                function (callback)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "SELECT " +
                            "forum_posts.post_topic_id, forum_posts.post_user_id, " +
                            "t1.topic_board_id AS topic_board_id " +
                            "FROM forum_posts " +
                            "LEFT JOIN forum_topics t1 ON t1.topic_id = forum_posts.post_topic_id " +
                            "WHERE post_id = ?",
                            timeout: 30000,
                            values: [postID]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                res.sendStatus(500);
                                return callback(true);
                            }
                            else
                            {
                                postData = results[0];
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
                            logger.info("Försöker komma åt en topic denne ej har access till. User = " + req.session.user);
                            res.sendStatus(403);
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    })
                },
                function (callback)
                {
                    if (postData.post_user_id == userData.user_id)
                    {
                        logger.info("Försöker reacta på sin egen post. User = " + userData.user_id);
                        res.sendStatus(500);
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
                            sql: "SELECT COUNT(*) AS count FROM forum_posts_reactions WHERE fpr_type = ? AND fpr_post_id = ? AND fpr_user_id = ?",
                            timeout: 30000,
                            values: [reactionType, postID, userData.user_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                res.sendStatus(500);
                                return callback(true);
                            }
                            else
                            {
                                if (results[0].count > 0)
                                {
                                    reactPostNeg(reactionType, postID, userData.user_id, postData.post_user_id, function (response)
                                    {
                                        if (response === true)
                                        {
                                            logger.info("Error när user försökte likea: User = " + userData.user_id);
                                            res.sendStatus(500);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            increase = false;
                                            callback(null);
                                        }
                                    });
                                }
                                else
                                {
                                    reactPostPos(reactionType, postID, userData.user_id, postData.post_user_id, function (response)
                                    {
                                        if (response === true)
                                        {
                                            logger.info("Error när user försökte likea: User = " + userData.user_id);
                                            res.sendStatus(500);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            increase = true;
                                            callback(null);
                                        }
                                    });
                                }
                            }
                        });
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
                    if (increase == true)
                    {
                        res.send("increase");
                    }
                    else if (increase == false)
                    {
                        res.send("decrease");
                    }
                    else
                    {
                        res.send(200);
                    }
                }
            });
    }
});

function reactPostPos(reactionType, postID, userID, postUserID, callback)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "INSERT INTO forum_posts_reactions SET fpr_type = ?, fpr_post_id = ?, fpr_user_id = ?",
            timeout: 30000,
            values: [reactionType, postID, userID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                res.sendStatus(500);
                return callback(true);
            }
            else
            {
                db.getForumConnection(function (err, connection)
                {
                    var temp = "user_total_" + reactionType;
                    connection.query({
                        sql: "UPDATE users SET ?? = ?? + 1 WHERE user_id = ?",
                        timeout: 30000,
                        values: [temp, temp, postUserID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            res.sendStatus(500);
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    });
                });
            }
        });
    });
}

function reactPostNeg(reactionType, postID, userID, postUserID, callback)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "DELETE FROM forum_posts_reactions WHERE fpr_type = ? AND fpr_post_id = ? AND fpr_user_id = ?",
            timeout: 30000,
            values: [reactionType, postID, userID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                res.sendStatus(500);
                return callback(true);
            }
            else
            {
                db.getForumConnection(function (err, connection)
                {
                    var temp = "user_total_" + reactionType;
                    connection.query({
                        sql: "UPDATE users SET ?? = ?? - 1 WHERE user_id = ?",
                        timeout: 30000,
                        values: [temp, temp, postUserID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            res.sendStatus(500);
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    });
                });
            }
        });
    });
}

module.exports = router;