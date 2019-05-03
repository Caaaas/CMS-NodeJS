var express = require('express');
var router = express.Router();
var util = require('util');
var async = require('async');
var paginator = require("paginator");
var clone = require('clone');
var functions = require.main.require('./utils/functions/topic');
var db = require.main.require('./utils/databases');
var threadAccess = require.main.require('./utils/canViewThread');
var topicTags = require.main.require('./utils/getTags');
var logger = require.main.require('./utils/logger');

router.get('/*', function (req, res, next) {
    var url = req.path.substr(1);

    if (url.substring(url.length - 1) === "/")
    {
        url = url.substring(0, url.length - 1);
    }

    var parts = url.split("/");

    var topicPage = 0;
    var topicID;

    var lastPage = 1;
    var directory = null;

    var topic;
    var posts;

    var postData = {};

    var pageInfo;
    var firstPostID;

    var canCreatePost = false;

    // Beräkna sida!
    if (parts.length > 2 || parts.length < 1)
    {
        var resErr = new Error();
        resErr.status = 404;
        next(resErr);
    }
    else if (parts.length > 0)
    {
        if (parts[0].lastIndexOf("-") > -1)
        {
            topicID = parseInt(parts[0].substr(parts[0].lastIndexOf("-") + 1, parts[0].length));
        }
        else
        {
            topicID = parseInt(parts[0]);
        }

        // Vi har nu topicID't, om det stämmer gå vidare, annars 404!
        if (typeof topicID !== "number" || isNaN(topicID))
        {
            logger.info("Försöker komma åt icke existerande topic i topic.js -> User = " + req.session.user);
            var resErr = new Error();
            resErr.status = 404;
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
                    function (callback) {
                        db.getForumConnection(function (err, connection) {
                            connection.query({
                                sql: "SELECT forum_topics.*, b1.board_locked FROM forum_topics LEFT JOIN forum_boards b1 ON b1.board_id = forum_topics.topic_board_id WHERE topic_id = ?",
                                timeout: 30000,
                                values: [topicID]
                            }, function (error, results) {
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
                    function (callback) {
                        /*
                         /trad/nyheter-hos-asa-21
                         /trad/nyheter-hos-asa-21/sida-2
                         /trad/nyheter-hos-asa-21/sista
                         /trad/nyheter-hos-asa-21/olast
                         */
                        if (parts.length > 1)
                        {
                            if (parts[1] === "olast")
                            {
                                // Om inte inloggad, gå till sista inlägget!
                                if (userData === null)
                                {
                                    functions.getLastPage(topicID, function (responsePage) {
                                        if (responsePage === 503 || responsePage === 404)
                                        {
                                            var resErr = new Error();
                                            resErr.status = responsePage;
                                            next(resErr);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            functions.getLastPost(topicID, function (responsePost) {
                                                if (responsePost == 503 || responsePost == 404)
                                                {
                                                    var resErr = new Error();
                                                    resErr.status = responsePost;
                                                    next(resErr);
                                                    return callback(true);
                                                }
                                                else
                                                {
                                                    res.redirect("/trad/" + parts[0] + "/sida-" + responsePage.lastPage + "#inlagg-" + responsePost.lastPost);
                                                    return callback(true);
                                                }
                                            });
                                        }
                                    });
                                }
                                else
                                {
                                    functions.getLastUnread(topicID, userData, function (response) {
                                        if (response == 503)
                                        {
                                            var resErr = new Error();
                                            resErr.status = 503;
                                            next(resErr);
                                            return callback(true);
                                        }
                                        else if (response.page === 0 && response.post === 0)
                                        {
                                            res.redirect("/trad/" + parts[0]);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            res.redirect("/trad/" + parts[0] + "/sida-" + response.page + "#inlagg-" + response.post);
                                            return callback(true);
                                        }
                                    });
                                }
                            }
                            else if (parts[1] === "sista")
                            {
                                /*
                                 Möjliga svar
                                 503

                                 response.page = X;
                                 response.post = X;
                                 */
                                functions.getLastPage(topicID, function (responsePage) {
                                    if (responsePage === 503 || responsePage === 404)
                                    {
                                        var resErr = new Error();
                                        resErr.status = responsePage;
                                        next(resErr);
                                        return callback(true);
                                    }
                                    else
                                    {
                                        functions.getLastPost(topicID, function (responsePost) {
                                            if (responsePost == 503 || responsePost == 404)
                                            {
                                                var resErr = new Error();
                                                resErr.status = responsePost;
                                                next(resErr);
                                                return callback(true);
                                            }
                                            else
                                            {
                                                res.redirect("/trad/" + parts[0] + "/sida-" + responsePage.lastPage + "#inlagg-" + responsePost.lastPost);
                                                return callback(true);
                                            }
                                        });
                                    }
                                });
                            }
                            else
                            {
                                if (parts[1].lastIndexOf("-") > -1)
                                {
                                    topicPage = parseInt(parts[1].substr(parts[1].lastIndexOf("-") + 1, parts[1].length));
                                }
                                else
                                {
                                    topicPage = parseInt(parts[1]);
                                }

                                if (typeof topicPage !== "number" || isNaN(topicPage))
                                {
                                    logger.info("Försökte komma åt en topic utan 'ID'. User = " + req.session.user);
                                    var resErr = new Error();
                                    resErr.status = 404;
                                    next(resErr);
                                    return callback(true);
                                }
                                else
                                {
                                    callback();
                                }
                            }
                        }
                        else
                        {
                            callback();
                        }
                    },
                    function (callback) {
                        functions.getLastPage(topicID, function (responsePage) {
                            lastPage = responsePage.lastPage;
                            callback();
                        });
                    },
                    function (callback) {
                        // Hämta alla "normala" posts som man vill läsa.
                        var offset;
                        if (topicPage == 0)
                            offset = global.settings.posts_per_page * topicPage;
                        else
                            offset = global.settings.posts_per_page * (topicPage - 1);

                        var sql = "SELECT forum_posts.*, u1.username AS post_username FROM forum_posts LEFT JOIN users u1 ON u1.user_id = forum_posts.post_user_id WHERE post_topic_id = ? AND post_hidden = 0 ORDER BY post_id ASC LIMIT ? OFFSET ?";

                        db.getForumConnection(function (err, connection) {
                            connection.query({
                                sql: sql,
                                timeout: 30000,
                                values: [topicID, global.settings.posts_per_page, offset]
                            }, function (error, results) {
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
                                        logger.info("Inga svar i tråden hittades.... User = " + req.session.user);
                                        var resErr = new Error();
                                        resErr.status = 404;
                                        next(resErr);
                                        return callback(true);
                                    }
                                    else
                                    {
                                        posts = results;
                                        callback();
                                    }
                                }
                            });
                        });
                    },
                    function (callback) {
                        // Om man är inloggad, så uppdaterar vi senaste lästa inlägget till det sista på sidan.
                        if (typeof req.session.user !== "undefined")
                        {
                            db.getForumConnection(function (err, connection) {
                                connection.query({
                                    sql: "SELECT * FROM forum_posts_read WHERE read_topic_id = ? AND read_user_id = ?",
                                    timeout: 30000,
                                    values: [topicID, req.session.user.user_id]
                                }, function (error, results) {
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
                                        var lastUnreadPost;
                                        for (var i = posts.length - 1; i >= 0; i--)
                                        {
                                            if (posts[i].post_hidden == 0)
                                            {
                                                lastUnreadPost = posts[i].post_id;
                                                i = -1;
                                            }
                                        }

                                        if (results.length == 0)
                                        {
                                            // HITTAR INTE, INSERTA!
                                            db.getForumConnection(function (err, connection) {
                                                connection.query({
                                                    sql: "INSERT INTO forum_posts_read SET read_user_id = ?, read_topic_id = ?, read_post_id = ?",
                                                    timeout: 30000,
                                                    values: [req.session.user.user_id, topicID, lastUnreadPost]
                                                }, function (error, results) {
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
                                                        callback();
                                                    }
                                                });
                                            });
                                        }
                                        else if (results[0].read_post_id < lastUnreadPost)
                                        {
                                            // HITTADE, UPDATE!
                                            db.getForumConnection(function (err, connection) {
                                                connection.query({
                                                    sql: "UPDATE forum_posts_read SET read_post_id = ? WHERE read_topic_id = ? AND read_user_id = ?",
                                                    timeout: 30000,
                                                    values: [lastUnreadPost, topicID, req.session.user.user_id]
                                                }, function (error, results) {
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
                        else
                        {
                            callback();
                        }
                    },
                    function (callback) {
                        db.getForumConnection(function (err, connection) {
                            connection.query({
                                sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? ORDER BY post_id ASC LIMIT 1",
                                timeout: 30000,
                                values: [topicID]
                            }, function (error, results) {
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
                    function (callback) {
                        async.eachOf(posts, function (post, index, nextInner) {
                            post.postData = clone(postData);
                            post.postData.post_datetime = post.post_datetime;
                            post.postData.post_user_id = post.post_user_id;
                            post.postData.post_hidden = post.post_hidden;
                            post.postData.firstPost = (firstPostID === post.post_id);
                            post.postData.post_id = post.post_id;

                            posts[index].user_groups = [];
                            db.getForumConnection(function (error, connection) {
                                connection.query({
                                    sql: "SELECT uag_group_id FROM users_active_groups WHERE uag_user_id = ?",
                                    timeout: 30000,
                                    values: [post.post_user_id]
                                }, function (error, results) {
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
                        }, function (error) {
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
                    function (callback) {
                        if (userData !== null)
                        {
                            async.eachOf(posts, function (post, index, nextInner) {
                                functions.canEditTopic(userData, post.post_id, post.postData, function (response) {
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
                            }, function (error) {
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
                    function (callback) {
                        if (userData !== null)
                        {
                            async.eachOf(posts, function (post, index, nextInner) {
                                functions.canEditPost(userData, post.post_id, post.postData, function (response) {
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
                            }, function (error) {
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
                    function (callback) {
                        for (var i = 0; i < posts.length; i++)
                        {
                            db.getForumConnection(function (i, err, connection) {
                                connection.query({
                                    sql: "SELECT user_total_posts, user_total_like, user_total_agree, user_total_insightful, user_total_promote, user_register_date FROM users WHERE user_id = ?",
                                    timeout: 30000,
                                    values: [posts[i].post_user_id]
                                }, function (error, results) {
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
                    function (callback) {
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
                            db.getForumConnection(function (i, err, connection) {
                                connection.query({
                                    sql: "SELECT * FROM forum_posts_reactions WHERE fpr_post_id = ?",
                                    timeout: 30000,
                                    values: [posts[i].post_id]
                                }, function (error, results) {
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
                    function (callback) {
                        async.eachOf(posts, function (post, index, nextOuter) {
                            async.eachOf(post.user_groups, function (group, indexInner, nextInner) {
                                db.getForumConnection(function (index, indexInner, error, connection) {
                                    connection.query({
                                        sql: "SELECT group_id, name, color, custom_order FROM user_groups WHERE group_id = ?",
                                        timeout: 30000,
                                        values: [group.uag_group_id]
                                    }, function (error, results) {
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
                            }, function (error) {
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

                            post.user_groups.sort(function (a, b) {
                                return (a.custom_order > b.custom_order) ? -1 : 1;
                            });
                        }, function (error) {
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
                    function (callback) {
                        topicTags.getTags(topic, function () {
                            callback();
                        })
                    },
                    function (callback) {
                        db.getForumConnection(function (err, connection) {
                            connection.query({
                                sql: "UPDATE forum_topics SET topic_views = topic_views + 1 WHERE topic_id = ?",
                                timeout: 30000,
                                values: [topicID]
                            }, function (error, results) {
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
                                    callback();
                                }
                            })
                        })
                    },
                    function (callback) {
                        if (typeof req.session.user !== "undefined")
                        {
                            functions.canCreatePost(userData, topicID, postData, function (response) {
                                if (response == false)
                                {
                                    callback();
                                }
                                else
                                {
                                    canCreatePost = true;
                                    callback();
                                }
                            })
                        }
                        else
                        {
                            callback();
                        }
                    },
                    function (callback) {
                        var pages = new paginator(global.settings.posts_per_page, 5);
                        pageInfo = pages.build(lastPage * global.settings.posts_per_page, topicPage + 1);
                        callback();
                    }

                ],
                function (error) {
                    if (error)
                    {
                        // Hanteras enskilt.
                    }
                    else
                    {
                        res.render('topic', {
                            session: req.session,
                            chat: req.chat,
                            lastPage: lastPage,
                            directory: directory,
                            topic: topic,
                            posts: posts,
                            currentPage: topicPage,
                            paginator: pageInfo,
                            canCreatePost: canCreatePost
                        });
                    }
                }
            );
        }
    }
})
;
module.exports = router;