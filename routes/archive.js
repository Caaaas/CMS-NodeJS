var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var clone = require('clone');
var async = require('async');
var threadAccess = require.main.require('./utils/canViewThread');
var logger = require.main.require('./utils/logger');
var topicTags = require.main.require('./utils/getTags');
var paginator = require("paginator");
var functions = require.main.require('./utils/functions/topic');

router.get('/tradar', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var url = req.path.substr(1);
    if (url.substring(url.length - 1) === "/")
        url = url.substring(0, url.length - 1);
    var parts = url.split("/");

    var page = 0; //page
    var offset;

    var topics;
    var pageInfo;
    var lastPage;

    async.series([
            function (callback)
            {
                if (userData === null)
                {
                    logger.info("Försöker komma åt arkiv utan att vara inloggad = " + JSON.stringify(req.session, null, 4));
                    var resErr = new Error();
                    resErr.status = 403;
                    next(resErr);
                    return callback(true);
                }
                else if (!userData.permissions.forum_hidden_view)
                {
                    logger.info("Försöker komma åt arkiv utan permission för det = " + JSON.stringify(req.session, null, 4));
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
                if (parts.length === 3)
                {
                    if (parts[2].lastIndexOf("-") > -1)
                    {
                        page = parseInt(parts[2].substr(parts[2].lastIndexOf("-") + 1, parts[2].length)) - 1;
                    }
                    else
                    {
                        page = parseInt(parts[2]) - 1;
                    }

                    if (typeof page !== "number" || isNaN(page) || page < 0)
                    {
                        logger.info("Försökte ange falska ID's för sida i arkiv. User = " + JSON.stringify(req.session.user));
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
                offset = global.settings.topics_per_page * page;

                /*                //var userGroups = [];
                                var userGroupsSQL = "(board_user_groups_can_view = 0";
                                for (var i = 0; i < req.session.user.groups.length; i++)
                                    userGroupsSQL += " OR board_user_groups_can_view LIKE '%-" + mysql.escape(req.session.user.groups[i].group_id) + "-%'";
                                userGroupsSQL += ") ";*/

                var sql =
                    "SELECT " +
                    "forum_topics.*, " +
                    "b1.board_title AS board_title, " +
                    "u1.username AS topic_last_user_posted_username, " +
                    "u2.username AS topic_creator_username, " +
                    "p1.post_datetime AS topic_last_post_date, " +
                    "r1.read_post_id AS user_last_read_post " +
                    "FROM forum_topics " +
                    "INNER JOIN forum_boards b1 ON b1.board_id = forum_topics.topic_board_id " +
                    "LEFT JOIN users u1 ON u1.user_id = forum_topics.topic_last_user_posted_id " +
                    "LEFT JOIN users u2 ON u2.user_id = forum_topics.topic_creator_id " +
                    "LEFT JOIN forum_posts p1 ON p1.post_id = forum_topics.topic_last_post_id " +
                    "LEFT JOIN forum_posts_read r1 ON r1.read_user_id = ? AND r1.read_topic_id = forum_topics.topic_id " +
                    "WHERE forum_topics.topic_hidden = 1 " +
                    "ORDER BY topic_sticky DESC, topic_last_post_id DESC LIMIT ? OFFSET ?";

                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: sql,
                        timeout: 30000,
                        values: [userData.user_id, global.settings.topics_per_page, offset]
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
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT COUNT(*) as count FROM forum_topics WHERE topic_hidden = 1",
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
                            lastPage = parseInt(results[0].count / global.settings.topics_per_page);
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                var pages = new paginator(global.settings.topics_per_page, 5);
                pageInfo = pages.build(lastPage * global.settings.topics_per_page, page + 1);
                callback();
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras enskilt.
            }
            else
            {
                res.render('archive', {
                    session: req.session,
                    chat: req.chat,
                    topics: topics,
                    paginator: pageInfo,
                    lastPage: lastPage,
                    archiveType: "topics"
                });
            }
        });
});

router.get('/inlagg', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var url = req.path.substr(1);
    if (url.substring(url.length - 1) === "/")
        url = url.substring(0, url.length - 1);
    var parts = url.split("/");

    var page = 0; //page
    var offset;

    var topics;
    var pageInfo;
    var lastPage;
    var topicIDS = [];

    async.series([
            function (callback)
            {
                if (userData === null)
                {
                    logger.info("Försöker komma åt arkiv utan att vara inloggad = " + JSON.stringify(req.session, null, 4));
                    var resErr = new Error();
                    resErr.status = 403;
                    next(resErr);
                    return callback(true);
                }
                else if (!userData.permissions.forum_hidden_view)
                {
                    logger.info("Försöker komma åt arkiv utan permission för det = " + JSON.stringify(req.session, null, 4));
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
                if (parts.length === 3)
                {
                    if (parts[2].lastIndexOf("-") > -1)
                    {
                        page = parseInt(parts[2].substr(parts[1].lastIndexOf("-") + 1, parts[2].length)) - 1;
                    }
                    else
                    {
                        page = parseInt(parts[2]) - 1;
                    }

                    if (typeof page !== "number" || isNaN(page) || page < 0)
                    {
                        logger.info("Försökte ange falska ID's för sida i arkiv. User = " + JSON.stringify(req.session.user));
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
                offset = global.settings.topics_per_page * page;

                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT DISTINCT post_topic_id FROM forum_posts WHERE post_hidden = 1 ORDER BY post_id DESC LIMIT ? OFFSET ?",
                        timeout: 30000,
                        values: [global.settings.topics_per_page, offset]
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
                            for (var i = 0; i < results.length; i++)
                            {
                                topicIDS.push(parseInt(results[i].post_topic_id));
                            }
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                offset = global.settings.topics_per_page * page;

                /*                //var userGroups = [];
                                var userGroupsSQL = "(board_user_groups_can_view = 0";
                                for (var i = 0; i < req.session.user.groups.length; i++)
                                    userGroupsSQL += " OR board_user_groups_can_view LIKE '%-" + mysql.escape(req.session.user.groups[i].group_id) + "-%'";
                                userGroupsSQL += ") ";*/

                var sql =
                    "SELECT " +
                    "forum_topics.*, " +
                    "b1.board_title AS board_title, " +
                    "u1.username AS topic_last_user_posted_username, " +
                    "u2.username AS topic_creator_username, " +
                    "p1.post_datetime AS topic_last_post_date, " +
                    "r1.read_post_id AS user_last_read_post " +
                    "FROM forum_topics " +
                    "INNER JOIN forum_boards b1 ON b1.board_id = forum_topics.topic_board_id " +
                    "LEFT JOIN users u1 ON u1.user_id = forum_topics.topic_last_user_posted_id " +
                    "LEFT JOIN users u2 ON u2.user_id = forum_topics.topic_creator_id " +
                    "LEFT JOIN forum_posts p1 ON p1.post_id = forum_topics.topic_last_post_id " +
                    "LEFT JOIN forum_posts_read r1 ON r1.read_user_id = ? AND r1.read_topic_id = forum_topics.topic_id " +
                    "WHERE forum_topics.topic_id IN (?) " +
                    "ORDER BY forum_topics.topic_last_post_id DESC LIMIT ? OFFSET ?";

                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: sql,
                        timeout: 30000,
                        values: [userData.user_id, topicIDS, global.settings.topics_per_page, offset]
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
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT COUNT(*) as count FROM forum_topics WHERE topic_hidden = 1",
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
                            lastPage = parseInt(results[0].count / global.settings.topics_per_page);
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                var pages = new paginator(global.settings.topics_per_page, 5);
                pageInfo = pages.build(lastPage * global.settings.topics_per_page, page + 1);
                callback();
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras enskilt.
            }
            else
            {
                res.render('archive', {
                    session: req.session,
                    chat: req.chat,
                    topics: topics,
                    paginator: pageInfo,
                    lastPage: lastPage,
                    archiveType: "posts"
                });
            }
        });
});

router.get('/inlagg*', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var url = req.path.substr(1);
    if (url.substring(url.length - 1) === "/")
        url = url.substring(0, url.length - 1);
    var parts = url.split("/");

    var topicPage = 0; //page
    var offset;

    var posts;
    var pageInfo;
    var lastPage;

    var directory;

    var topic;
    var topicID;

    var postData = {};
    var firstPostID;
    async.series([
            function (callback)
            {
                if (userData === null)
                {
                    logger.info("Försöker komma åt arkiv utan att vara inloggad = " + JSON.stringify(req.session, null, 4));
                    var resErr = new Error();
                    resErr.status = 403;
                    next(resErr);
                    return callback(true);
                }
                else if (!userData.permissions.forum_hidden_view)
                {
                    logger.info("Försöker komma åt arkiv utan permission för det = " + JSON.stringify(req.session, null, 4));
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
                if (parts[1].lastIndexOf("-") > -1)
                {
                    topicID = parseInt(parts[1].substr(parts[1].lastIndexOf("-") + 1, parts[1].length));
                }
                else
                {
                    topicID = parseInt(parts[1]);
                }

                if (typeof topicID !== "number" || isNaN(topicID) || topicID < 0)
                {
                    logger.info("Försökte ange falska ID's för topicID i arkiv. User = " + JSON.stringify(req.session.user));
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
                if (parts.length === 3)
                {
                    if (parts[2].lastIndexOf("-") > -1)
                    {
                        topicPage = parseInt(parts[2].substr(parts[2].lastIndexOf("-") + 1, parts[2].length)) - 1;
                    }
                    else
                    {
                        topicPage = parseInt(parts[2]) - 1;
                    }

                    if (typeof topicPage !== "number" || isNaN(topicPage) || topicPage < 0)
                    {
                        logger.info("Försökte ange falska ID's för sida i arkiv. User = " + JSON.stringify(req.session.user));
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
                        sql: "SELECT forum_topics.*, b1.board_locked FROM forum_topics LEFT JOIN forum_boards b1 ON b1.board_id = forum_topics.topic_board_id WHERE topic_id = ?",
                        timeout: 30000,
                        values: [topicID]
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
                                logger.info("Försöker komma åt en topic som inte finns. User = " + req.session.user);
                                var resErr = new Error();
                                resErr.status = 404;
                                next(resErr);
                                return callback(true);
                            }
                            else
                            {
                                postData.topic_creator_id = results[0].topic_creator_id;
                                postData.topic_locked = results[0].topic_locked;
                                postData.topic_hidden = results[0].topic_hidden;
                                postData.board_locked = results[0].board_locked;
                                postData.topic_creation_date = results[0].topic_creation_date;

                                topic = results[0];
                                callback();
                            }
                        }
                    });
                });
            },
            function (callback) {
                threadAccess.canViewThread(topic.topic_board_id, topicID, userData, function (response) {
                    if (response === false)
                    {
                        logger.info("Försöker komma åt en topic denne ej har access till. User = " + req.session.user);
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
                })
            },
            function (callback)
            {
                offset = global.settings.topics_per_page * topicPage;

                /*                //var userGroups = [];
                                var userGroupsSQL = "(board_user_groups_can_view = 0";
                                for (var i = 0; i < req.session.user.groups.length; i++)
                                    userGroupsSQL += " OR board_user_groups_can_view LIKE '%-" + mysql.escape(req.session.user.groups[i].group_id) + "-%'";
                                userGroupsSQL += ") ";*/

                if (topicPage == 0)
                    offset = global.settings.posts_per_page * topicPage;
                else
                    offset = global.settings.posts_per_page * (topicPage - 1);

                var sql = "SELECT forum_posts.*, " +
                    "u1.username AS post_username " +
                    "FROM forum_posts " +
                    "LEFT JOIN users u1 ON u1.user_id = forum_posts.post_user_id " +
                    "WHERE post_topic_id = ? AND post_hidden = 1 " +
                    "ORDER BY post_id ASC LIMIT ? OFFSET ?";

                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: sql,
                        timeout: 30000,
                        values: [topicID, global.settings.posts_per_page, offset]
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
                            posts = results;
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
                        sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? ORDER BY post_id ASC LIMIT 1",
                        timeout: 30000,
                        values: [topicID]
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
                            firstPostID = results[0].post_id;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                async.eachOf(posts, function (post, index, nextInner)
                {
                    post.postData = clone(postData);
                    post.postData.post_datetime = post.post_datetime;
                    post.postData.post_user_id = post.post_user_id;
                    post.postData.post_hidden = post.post_hidden;
                    post.postData.firstPost = (firstPostID === post.post_id);
                    post.postData.post_id = post.post_id;

                    posts[index].user_groups = [];
                    db.getForumConnection(function (error, connection)
                    {
                        connection.query({
                            sql: "SELECT uag_group_id FROM users_active_groups WHERE uag_user_id = ?",
                            timeout: 30000,
                            values: [post.post_user_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                return nextInner(true);
                            }
                            else
                            {
                                posts[index].user_groups = results;

                                nextInner();
                            }
                        });
                    }.bind(db));
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
                if (userData !== null)
                {
                    async.eachOf(posts, function (post, index, nextInner)
                    {
                        functions.canEditTopic(userData, post.post_id, post.postData, function (response)
                        {
                            if (response === false || !post.postData.firstPost)
                            {
                                post.postData.editTopic = false;
                                nextInner();
                            }
                            else
                            {
                                post.postData.editTopic = true;
                                nextInner();
                            }
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
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (userData !== null)
                {
                    async.eachOf(posts, function (post, index, nextInner)
                    {
                        functions.canEditPost(userData, post.post_id, post.postData, function (response)
                        {
                            if (response === false)
                            {
                                post.postData.editPost = false;
                                nextInner();
                            }
                            else
                            {
                                post.postData.editPost = true;
                                nextInner();
                            }
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
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                for (var i = 0; i < posts.length; i++)
                {
                    db.getForumConnection(function (i, err, connection)
                    {
                        connection.query({
                            sql: "SELECT user_total_posts, user_total_like, user_total_agree, user_total_insightful, user_total_promote, user_register_date FROM users WHERE user_id = ?",
                            timeout: 30000,
                            values: [posts[i].post_user_id]
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
                                    var resErr = new Error();
                                    resErr.status = 503;
                                    next(resErr);
                                    return callback(true);
                                }
                                else
                                {
                                    posts[i].user_total_posts = results[0].user_total_posts;
                                    posts[i].user_total_like = results[0].user_total_like;
                                    posts[i].user_total_agree = results[0].user_total_agree;
                                    posts[i].user_total_insightful = results[0].user_total_insightful;
                                    posts[i].user_total_promote = results[0].user_total_promote;
                                    posts[i].user_register_date = results[0].user_register_date;

                                    if (i == posts.length - 1)
                                        callback();
                                }
                            }
                        });
                    }.bind(db, i));
                }
            },
            function (callback)
            {
                var count = 0;

                function whenToCallback()
                {
                    count++;
                    if (count == posts.length)
                    {
                        callback();
                    }
                }

                for (var i = 0; i < posts.length; i++)
                {
                    db.getForumConnection(function (i, err, connection)
                    {
                        connection.query({
                            sql: "SELECT * FROM forum_posts_reactions WHERE fpr_post_id = ?",
                            timeout: 30000,
                            values: [posts[i].post_id]
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
                                posts[i].reactions = {};
                                posts[i].reactions.like = [];
                                posts[i].reactions.agree = [];
                                posts[i].reactions.insightful = [];
                                posts[i].reactions.promote = [];
                                if (results.length == 0)
                                {
                                    whenToCallback();
                                }
                                else
                                {
                                    for (var j = 0; j < results.length; j++)
                                    {
                                        if (results[j].fpr_type == "like")
                                        {
                                            posts[i].reactions.like.push(results[j]);
                                        }
                                        else if (results[j].fpr_type == "agree")
                                        {
                                            posts[i].reactions.agree.push(results[j]);
                                        }
                                        else if (results[j].fpr_type == "insightful")
                                        {
                                            posts[i].reactions.insightful.push(results[j]);
                                        }
                                        else if (results[j].fpr_type == "promote")
                                        {
                                            posts[i].reactions.promote.push(results[j]);
                                        }

                                        if (j == results.length)
                                        {

                                        }
                                    }
                                    whenToCallback();
                                }
                            }
                        });
                    }.bind(db, i));
                }
            },
            function (callback)
            {
                async.eachOf(posts, function (post, index, nextOuter)
                {
                    async.eachOf(post.user_groups, function (group, indexInner, nextInner)
                    {
                        db.getForumConnection(function (index, indexInner, error, connection)
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
                                    posts[index].user_groups[indexInner] = results[0];
                                    nextInner();
                                }
                            })
                        }.bind(db, index, indexInner));
                    }, function (error)
                    {
                        if (error)
                        {
                            logger.info(error);
                            return nextOuter(true);
                        }
                        else
                        {
                            nextOuter();
                        }
                    });

                    post.user_groups.sort(function (a, b)
                    {
                        return (a.custom_order > b.custom_order) ? -1 : 1;
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
                topicTags.getTags(topic, function ()
                {
                    callback();
                })
            },
            function (callback)
            {
                var pages = new paginator(global.settings.topics_per_page, 5);
                pageInfo = pages.build(lastPage * global.settings.topics_per_page, topicPage + 1);
                callback();
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras enskilt.
            }
            else
            {
                res.render('topic', {
                    session: req.session,
                    chat: req.chat,
                    paginator: pageInfo,
                    lastPage: lastPage,
                    directory: directory,
                    topic: topic,
                    posts: posts,
                    currentPage: topicPage,
                    canCreatePost: false
                });
            }
        });
});

module.exports = router;