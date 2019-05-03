var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var functions = require.main.require('./utils/functions/topic');
var functionsForum = require.main.require('./utils/functions/forum');
var functionsGeneral = require.main.require('./utils/functions/general');
var threadAccess = require.main.require('./utils/canViewThread');
var logger = require.main.require('./utils/logger');
var clone = require('clone');

router.post('/', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var postID = req.body.post_id.trim();

    /*var postTopicID;
    var firstPostID;
    var postBoardID;

    var parentBoard;

    var lastTopicID;
    var lastPostID;
    var activePostsInTopic;
    var subBoard;
    var topicHidden;

    var boardTitle;
    var topicTitle;*/

    var boardsAndSubBoards = [];

    var directory;
    var returnObject = {};

    var newPage = 0;
    var newPost = 0;

    var postData = {};
    if (!postID)
    {
        logger.info("Försöker radera post utan att skicka med ID.");
        res.sendStatus(503);
    }
    else
    {
        async.series([
                function (callback)
                {
                    if (userData !== null)
                    {
                        callback();
                    }
                    else
                    {
                        logger.info("Försöker radera post utan att vara inloggad.");
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
                        logger.info("Försöker radera inlägg utan giltigt POSTID.");
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
                            "forum_posts.post_topic_id, " +
                            "forum_posts.post_user_id, " +
                            "forum_posts.post_hidden, " +
                            "t1.topic_board_id, " +
                            "t1.topic_title, " +
                            "t1.topic_creator_id, " +
                            "t1.topic_posts, " +
                            "t1.topic_hidden, " +
                            "b1.board_sub_board_to," +
                            "b1.board_title " +
                            "FROM forum_posts " +
                            "LEFT JOIN forum_topics t1 ON t1.topic_id = forum_posts.post_topic_id " +
                            "LEFT JOIN forum_boards b1 ON b1.board_id = t1.topic_board_id " +
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
                                postData.post_user_id = results[0].post_user_id;
                                postData.topic_id = results[0].post_topic_id;
                                postData.board_id = results[0].topic_board_id;
                                postData.topic_posts = results[0].topic_posts;
                                postData.board_sub_board = results[0].board_sub_board_to;
                                postData.parent_board = [results[0].topic_board_id];
                                postData.board_title = results[0].board_title;
                                postData.topic_title = results[0].topic_title;
                                postData.topic_creator_id = results[0].topic_creator_id;
                                postData.topic_hidden = results[0].topic_hidden;
                                postData.post_hidden = results[0].post_hidden;

                                postData.post_id = postID;
                                callback();
                            }
                        });
                    });
                },
                function (callback)
                {
                    if (postData.board_sub_board > 0)
                    {
                        var tempBoardID = clone(postData.board_id);
                        findParentBoard();

                        function findParentBoard()
                        {
                            db.getForumConnection(function (err, connection)
                            {
                                connection.query({
                                    sql: "SELECT board_id, board_sub_board_to FROM forum_boards WHERE board_id = ?",
                                    timeout: 30000,
                                    values: [tempBoardID]
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
                                        postData.parent_board = [results[0].board_id];
                                        if (results[0].board_sub_board_to > 0)
                                        {
                                            tempBoardID = results[0].board_sub_board_to;
                                            findParentBoard();
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
                    else
                    {
                        callback();
                    }
                },
                function (callback)
                {
                    functionsForum.findChildBoards(postData.parent_board, function (response)
                    {
                        if (response === true)
                        {
                            logger.info("Error när försökte hitta child boards i delete av tråd = " + req.session.user);
                            res.sendStatus(403);
                            return callback(true);
                        }
                        else
                        {
                            postData.boards_and_sub_boards = response;
                            callback();
                        }
                    });
                },
                function (callback)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? ORDER BY post_id ASC LIMIT 1",
                            timeout: 30000,
                            values: [postData.topic_id]
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
                                postData.first_post_id = results[0].post_id;
                                callback();
                            }
                        });
                    });
                },
                function (callback)
                {
                    threadAccess.canViewThread(postData.board_id, postData.topic_id, userData, function (response)
                    {
                        if (response === false)
                        {
                            logger.info("Försöker radera en post de ej har access till. User = " + JSON.stringify(req.session.user, null, 4));
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
                    if (postData.first_post_id === postID)
                    {
                        functions.canDeleteTopic(userData, postData, function (response)
                        {
                            if (response === false)
                            {
                                return callback(true);
                            }
                            else
                            {
                                if (postData.topic_hidden)
                                {
                                    if (userData.permissions.forum_hidden_view)
                                    {
                                        topicUndelete(userData, postData, function (innerResponse)
                                        {
                                            if (innerResponse === true)
                                            {
                                                logger.info("Fel vid undelete av topic i topicUndelete = " + JSON.stringify(req.session.user, null, 4));
                                                res.sendStatus(503);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                returnObject.url = "/trad/" + encodeURIComponent(functionsGeneral.customURLEncode(postData.topic_title)) + "-" + postData.topic_id;
                                                callback();
                                            }
                                        });
                                    }
                                }
                                else
                                {
                                    topicDelete(userData, postData, function (innerResponse)
                                    {
                                        if (innerResponse === true)
                                        {
                                            logger.info("Fel vid raderande av topic i topicDelete = " + JSON.stringify(req.session.user, null, 4));
                                            res.sendStatus(503);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            returnObject.url = "/forum/" + encodeURIComponent(functionsGeneral.customURLEncode(postData.board_title)) + "-" + postData.board_id;
                                            callback();
                                        }
                                    });
                                }
                            }
                        });
                    }
                    else
                    {
                        functions.canDeletePost(userData, postData, function (response)
                        {
                            if (response === false || postData.topic_hidden)
                            {
                                return callback(true);
                            }
                            else
                            {
                                if (postData.post_hidden)
                                {
                                    if (userData.permissions.forum_hidden_view)
                                    {
                                        postUndelete(userData, postData, function (innerResponse)
                                        {
                                            if (innerResponse === true)
                                            {
                                                logger.info("Fel vid undelete av post i postUndelete = " + JSON.stringify(req.session.user, null, 4));
                                                res.sendStatus(503);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                functions.getPageFromPost(postData.topic_id, postData.post_id, function (response)
                                                {
                                                    if (response === 503)
                                                    {
                                                        var resErr = new Error();
                                                        resErr.status = 503;
                                                        next(resErr);
                                                        return callback(true);
                                                    }
                                                    else if (response.page === 0)
                                                    {
                                                        returnObject.url = "/trad/" + encodeURIComponent(functionsGeneral.customURLEncode(postData.topic_title)) + "-" + postData.topic_id + "#inlagg-" + postData.post_id;
                                                        callback();
                                                    }
                                                    else
                                                    {
                                                        newPage = response.page;
                                                        returnObject.url = "/trad/" + encodeURIComponent(functionsGeneral.customURLEncode(postData.topic_title)) + "-" + postData.topic_id + "/sida-" + newPage + "#inlagg-" + postData.post_id;
                                                        callback();
                                                    }
                                                });
                                            }
                                        });
                                    }
                                }
                                else
                                {
                                    postDelete(userData, postData, function (innerResponse)
                                    {
                                        if (innerResponse === true)
                                        {
                                            logger.info("Fel vid raderande av post i postDelete = " + JSON.stringify(req.session.user, null, 4));
                                            res.sendStatus(503);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            functions.getLastUnread(postData.topic_id, userData, function (response)
                                            {
                                                if (response === 503)
                                                {
                                                    var resErr = new Error();
                                                    resErr.status = 503;
                                                    next(resErr);
                                                    return callback(true);
                                                }
                                                else if (response.page === 0 && response.post === 0)
                                                {
                                                    callback();
                                                }
                                                else
                                                {
                                                    newPage = response.page;
                                                    newPost = response.post;
                                                    returnObject.url = "/trad/" + encodeURIComponent(functionsGeneral.customURLEncode(postData.topic_title)) + "-" + postData.topic_id + "/sida-" + newPage + "#inlagg-" + newPost;
                                                    callback();
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
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
                    res.send(returnObject);
                }
            });
    }
});

function topicDelete(userData, postData, next)
{
    var reactions;
    var postUsers;
    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT post_user_id FROM forum_posts WHERE post_topic_id = ? AND post_hidden = 0",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            postUsers = results;
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
                        sql: "UPDATE forum_topics SET topic_hidden = 1 WHERE topic_id = ?",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT topic_id FROM forum_topics WHERE topic_board_id IN (?) AND topic_hidden = 0 ORDER BY topic_id DESC LIMIT 1",
                        timeout: 30000,
                        values: [postData.boards_and_sub_boards]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            if (results.length === 0)
	                            postData.new_topic_id = 0;
                            else
	                            postData.new_topic_id = results[0].topic_id;

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
                        sql: "SELECT forum_posts.post_id, forum_posts.post_user_id, fpr1.fpr_type FROM forum_posts INNER JOIN forum_posts_reactions fpr1 ON fpr_post_id = forum_posts.post_id WHERE post_topic_id = ? AND post_hidden = 0",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            reactions = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.eachOf(reactions, function (reaction, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        var temp = "user_total_" + reaction.fpr_type;
                        connection.query({
                            sql: "UPDATE users SET ?? = ?? - 1 WHERE user_id = ?",
                            timeout: 30000,
                            values: [temp, temp, reaction.post_user_id]
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
                                nextInner();
                            }
                        });
                    });
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                async.eachOf(postUsers, function (user, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "UPDATE users SET user_total_posts = user_total_posts - 1 WHERE user_id = ?",
                            timeout: 30000,
                            values: [user.post_user_id]
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
                                nextInner();
                            }
                        });
                    });
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE users SET user_total_topics = user_total_topics - 1 WHERE user_id = ?",
                        timeout: 30000,
                        values: [postData.topic_creator_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                            'board_topics = board_topics - 1,' +
                            'board_posts = board_posts - ? ' +
                            'WHERE board_id = ?',
                            timeout: 30000,
                            values: [postData.new_topic_id, postData.topic_posts, postData.board_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return callback(true);
                            }
                            else
                            {
                                if (postData.board_sub_board > 0)
                                {
                                    db.getForumConnection(function (err, connection)
                                    {
                                        connection.query({
                                            sql: 'SELECT board_sub_board_to FROM forum_boards WHERE board_id = ?',
                                            timeout: 30000,
                                            values: [postData.board_sub_board]
                                        }, function (error, results)
                                        {
                                            connection.release();
                                            if (error)
                                            {
                                                logger.info(error);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                postData.board_id = postData.board_sub_board;
                                                postData.board_sub_board = parseInt(results[0].board_sub_board_to);
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
                return next(true);
            }
            else
            {
                next();
            }
        });
}

function postDelete(userData, postData, next)
{
    var reactions;
    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE forum_posts SET post_hidden = 1 WHERE post_id = ?",
                        timeout: 30000,
                        values: [postData.post_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? AND post_hidden = 0 ORDER BY post_id DESC LIMIT 1",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            postData.new_post_id = results[0].post_id;
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
                        sql: "UPDATE forum_topics SET topic_posts = topic_posts - 1, topic_last_post_id = ? WHERE topic_id = ?",
                        timeout: 30000,
                        values: [postData.new_post_id, postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE forum_posts_read SET read_post_id = ? WHERE read_topic_id = ? AND read_post_id = ?",
                        timeout: 30000,
                        values: [postData.new_post_id, postData.topic_id, postData.post_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT forum_posts.post_id, forum_posts.post_user_id, fpr1.fpr_type FROM forum_posts INNER JOIN forum_posts_reactions fpr1 ON fpr_post_id = forum_posts.post_id WHERE post_id = ?",
                        timeout: 30000,
                        values: [postData.post_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            reactions = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.eachOf(reactions, function (reaction, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        var temp = "user_total_" + reaction.fpr_type;
                        connection.query({
                            sql: "UPDATE users SET ?? = ?? - 1 WHERE user_id = ?",
                            timeout: 30000,
                            values: [temp, temp, reaction.post_user_id]
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
                                nextInner();
                            }
                        });
                    });
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE users SET user_total_posts = user_total_posts - 1 WHERE user_id = ?",
                        timeout: 30000,
                        values: [postData.post_user_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                            sql: 'UPDATE forum_boards SET board_posts = board_posts - 1 WHERE board_id = ?',
                            timeout: 30000,
                            values: [postData.board_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return callback(true);
                            }
                            else
                            {
                                if (postData.board_sub_board > 0)
                                {
                                    db.getForumConnection(function (err, connection)
                                    {
                                        connection.query({
                                            sql: 'SELECT board_sub_board_to FROM forum_boards WHERE board_id = ?',
                                            timeout: 30000,
                                            values: [postData.board_sub_board]
                                        }, function (error, results)
                                        {
                                            connection.release();
                                            if (error)
                                            {
                                                logger.info(error);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                postData.board_id = postData.board_sub_board;
                                                postData.board_sub_board = parseInt(results[0].board_sub_board_to);
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
                return next(true);
            }
            else
            {
                next();
            }
        });
}

function topicUndelete(userData, postData, next)
{
    var reactions;
    var postUsers;
    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE forum_topics SET topic_hidden = 0 WHERE topic_id = ?",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT post_user_id FROM forum_posts WHERE post_topic_id = ? AND post_hidden = 0",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            postUsers = results;
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
                        sql: "SELECT topic_id FROM forum_topics WHERE topic_board_id IN (?) AND topic_hidden = 0 ORDER BY topic_id DESC LIMIT 1",
                        timeout: 30000,
                        values: [postData.boards_and_sub_boards]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            postData.new_topic_id = results[0].topic_id;
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
                        sql: "SELECT forum_posts.post_id, forum_posts.post_user_id, fpr1.fpr_type FROM forum_posts INNER JOIN forum_posts_reactions fpr1 ON fpr_post_id = forum_posts.post_id WHERE post_topic_id = ? AND post_hidden = 0",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            reactions = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.eachOf(reactions, function (reaction, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        var temp = "user_total_" + reaction.fpr_type;
                        connection.query({
                            sql: "UPDATE users SET ?? = ?? + 1 WHERE user_id = ?",
                            timeout: 30000,
                            values: [temp, temp, reaction.post_user_id]
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
                                nextInner();
                            }
                        });
                    });
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                async.eachOf(postUsers, function (user, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "UPDATE users SET user_total_posts = user_total_posts + 1 WHERE user_id = ?",
                            timeout: 30000,
                            values: [user.post_user_id]
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
                                nextInner();
                            }
                        });
                    });
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE users SET user_total_topics = user_total_topics + 1 WHERE user_id = ?",
                        timeout: 30000,
                        values: [postData.topic_creator_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                            'board_posts = board_posts + ? ' +
                            'WHERE board_id = ?',
                            timeout: 30000,
                            values: [postData.new_topic_id, postData.topic_posts, postData.board_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return callback(true);
                            }
                            else
                            {
                                if (postData.board_sub_board > 0)
                                {
                                    db.getForumConnection(function (err, connection)
                                    {
                                        connection.query({
                                            sql: 'SELECT board_sub_board_to FROM forum_boards WHERE board_id = ?',
                                            timeout: 30000,
                                            values: [postData.board_sub_board]
                                        }, function (error, results)
                                        {
                                            connection.release();
                                            if (error)
                                            {
                                                logger.info(error);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                postData.board_id = postData.board_sub_board;
                                                postData.board_sub_board = parseInt(results[0].board_sub_board_to);
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
                return next(true);
            }
            else
            {
                next();
            }
        });
}

function postUndelete(userData, postData, next)
{
    var reactions;
    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE forum_posts SET post_hidden = 0 WHERE post_id = ?",
                        timeout: 30000,
                        values: [postData.post_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? AND post_hidden = 0 ORDER BY post_id DESC LIMIT 1",
                        timeout: 30000,
                        values: [postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            postData.new_post_id = results[0].post_id;
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
                        sql: "UPDATE forum_topics SET topic_posts = topic_posts + 1, topic_last_post_id = ? WHERE topic_id = ?",
                        timeout: 30000,
                        values: [postData.new_post_id, postData.topic_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE forum_posts_read SET read_post_id = ? WHERE read_topic_id = ? AND read_post_id = ?",
                        timeout: 30000,
                        values: [postData.new_post_id, postData.topic_id, postData.post_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT forum_posts.post_id, forum_posts.post_user_id, fpr1.fpr_type FROM forum_posts INNER JOIN forum_posts_reactions fpr1 ON fpr_post_id = forum_posts.post_id WHERE post_id = ?",
                        timeout: 30000,
                        values: [postData.post_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            reactions = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.eachOf(reactions, function (reaction, index, nextInner)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        var temp = "user_total_" + reaction.fpr_type;
                        connection.query({
                            sql: "UPDATE users SET ?? = ?? + 1 WHERE user_id = ?",
                            timeout: 30000,
                            values: [temp, temp, reaction.post_user_id]
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
                                nextInner();
                            }
                        });
                    });
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
                        callback();
                    }
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE users SET user_total_posts = user_total_posts + 1 WHERE user_id = ?",
                        timeout: 30000,
                        values: [postData.post_user_id]
                    }, function (error, results)
                    {
                        connection.release();
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
                            sql: 'UPDATE forum_boards SET board_posts = board_posts + 1 WHERE board_id = ?',
                            timeout: 30000,
                            values: [postData.board_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                return callback(true);
                            }
                            else
                            {
                                if (postData.board_sub_board > 0)
                                {
                                    db.getForumConnection(function (err, connection)
                                    {
                                        connection.query({
                                            sql: 'SELECT board_sub_board_to FROM forum_boards WHERE board_id = ?',
                                            timeout: 30000,
                                            values: [postData.board_sub_board]
                                        }, function (error, results)
                                        {
                                            connection.release();
                                            if (error)
                                            {
                                                logger.info(error);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                postData.board_id = postData.board_sub_board;
                                                postData.board_sub_board = parseInt(results[0].board_sub_board_to);
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
                return next(true);
            }
            else
            {
                next();
            }
        });
}

function getLatestPostInBoard(boardID) {

}

module.exports = router;