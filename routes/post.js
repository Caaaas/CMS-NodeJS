var express = require('express');
var router = express.Router();
var functions = require.main.require('./utils/functions/topic');
var functionsGeneral = require.main.require('./utils/functions/general');
var db = require.main.require('./utils/databases');
var logger = require.main.require('./utils/logger');

// http://localhost:3000/post/17-nyheter
router.get('/*', function (req, res, next)
{
    var url = req.path.substr(1);
    var parts = url.split("/");

    parts[1] = parseInt(parts[1]);

    var postID;
    var topicID;
    var topicTitle;
    var boardID;
    var postsBeforeThis;
    var topicPage;

    if (parts.length > 2 || parts.length < 1)
    {
        res.sendStatus(404);
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
            logger.info("Inget nummer/ogiltigt nummer, när användare försökte nå en post med länk. User = " + JSON.stringify(req.session.user));
            var resErr = new Error();
            resErr.status = 404;
            next(resErr);
            return callback(true);
        }
        else
        {
            db.getForumConnection(function (err, connection)
            {
                connection.query({
                    sql: "SELECT post_topic_id, t1.topic_title FROM forum_posts LEFT JOIN forum_topics t1 ON t1.topic_id = post_topic_id WHERE post_id = ?",
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
                    }
                    else
                    {
                        topicID = results[0].post_topic_id;
                        topicTitle = results[0].topic_title;
                        functions.getPageFromPost(topicID, postID, function (responsePage)
                        {
                            if (responsePage == 503)
                            {
                                var resErr = new Error();
                                resErr.status = responsePage;
                                next(resErr);
                            }
                            else
                            {
                                res.redirect("/trad/" + encodeURIComponent(functionsGeneral.customURLEncode(topicTitle)) + "-" + topicID + "/sida-" + responsePage.page + "#inlagg-" + postID);
                            }
                        });
                    }
                });
            });



            /*if (url.length > 1)
             {
             if (typeof parts[1] === 'number' && (parts[1] % 1) === 0 && parts[1] > 0)
             {
             boardPage = parts[1] - 1;
             }
             }*//*
            async.series([
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT post_topic_id FROM forum_posts WHERE post_id = ? AND post_hidden = 0",
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
                                    if (results.length == 0)
                                    {
                                        logger.info("Försökte hämta en post som inte finns. User = " + JSON.stringify(req.session.user));
                                        var resErr = new Error();
                                        resErr.status = 404;
                                        next(resErr);
                                        return callback(true);
                                    }
                                    else
                                    {
                                        topicID = results[0].post_topic_id;
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
                                sql: "SELECT topic_title, topic_board_id FROM forum_topics WHERE topic_id = ?",
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
                                        logger.info("Försökte hämta info från en tråd som inte finns. User = " + JSON.stringify(req.session.user));
                                        var resErr = new Error();
                                        resErr.status = 404;
                                        next(resErr);
                                        return callback(true);
                                    }
                                    else
                                    {
                                        boardID = results[0].topic_board_id;
                                        topicTitle = results[0].topic_title;
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

                        threadAccess.canViewThread(boardID, topicID, userData, function (response)
                        {
                            if (response === false)
                            {
                                logger.info("Försökte komma åt en post/topic som denne inte har access till. User = " + JSON.stringify(req.session.user));
                                var resErr = new Error();
                                resErr.status = 403;
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
                                sql: "SELECT COUNT(1) as count FROM forum_posts WHERE post_topic_id = ? AND post_id < ?",
                                timeout: 30000,
                                values: [topicID, postID]
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
                                    postsBeforeThis = results[0].count;
                                    topicPage = Math.floor(postsBeforeThis / global.settings.posts_per_page) + 1;
                                    callback();
                                }
                            });
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
                        if (typeof topicPage === "number" && topicPage > 1)
                            res.redirect('/trad/' + encodeURIComponent(functions.customURLEncode(topicTitle)) + "-" + topicID + "/sida-" + topicPage);
                        else
                            res.redirect('/trad/' + encodeURIComponent(functions.customURLEncode(topicTitle)) + "-" + topicID);
                    }
                }
            );*/
        }
    }
});
module.exports = router;