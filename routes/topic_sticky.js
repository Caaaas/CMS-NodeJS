var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require('async');
var threadAccess = require.main.require('./utils/canViewThread');
var logger = require.main.require('./utils/logger');

router.post('/', function (req, res, next)
{
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var topicID = parseInt(req.body.topic_id.trim());

    var data;

    var stickyTopic = false;

    var returnObject = {};

    if (typeof topicID !== "number" || isNaN(topicID))
    {
        logger.info("Försökte ange falska ID's för vid Sticky av tråd. User = " + req.session.user);
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
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "SELECT topic_sticky, topic_board_id FROM forum_topics WHERE topic_id = ?",
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
                                if (results.length !== 1)
                                {
                                    logger.info("Försöker stickya en tråd som inte finns. User = " + req.session.user);
                                    res.sendStatus(404);
                                    return callback(true);
                                }
                                else
                                {
                                    data = results[0];
                                    callback();
                                }
                            }
                        });
                    });
                },
                function (callback)
                {
                    threadAccess.canViewThread(data.topic_board_id, topicID, userData, function (response)
                    {
                        if (response === false)
                        {
                            logger.info("Försöker stickya en post de ej har access till. User = " + req.session.user);
                            res.sendStatus(403);
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
                    if (userData.permissions.topic_sticky)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'UPDATE forum_topics SET topic_sticky = ? WHERE topic_id = ?',
                                timeout: 30000,
                                values: [!data.topic_sticky, topicID]
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
                    returnObject.newStatus = !data.topic_sticky;
                    res.send(returnObject);
                }
            }
        );
    }
});

module.exports = router;
