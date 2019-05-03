var async = require("async");
var db = require.main.require('./utils/databases');
var moment = require('moment');

/*
 Möjliga svar
 503

 response.page = X;
 response.post = X;
 */
function getLastUnread (topicID, userData, callback)
{
    var returnValue = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT * FROM forum_posts_read WHERE read_user_id = ? AND read_topic_id = ?",
            timeout: 30000,
            values: [userData.user_id, topicID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                callback(503);
            }
            else
            {
                if (results.length == 0)
                {
                    // Inte varit i tråden innan, ta första sidan, första inlägget.
                    returnValue.page = 0;
                    returnValue.post = 0;
                    callback(returnValue);
                }
                else
                {
                    newPostsExist(topicID, results[0].read_post_id, function (response1)
                    {
                        if (response1 == 503)
                        {
                            callback(503);
                        }
                        else if (response1 == false)
                        {
                            returnValue.post = results[0].read_post_id;
                        }
                        else
                        {
                            returnValue.post = response1.newPost;
                        }

                        getPageFromPost(topicID, returnValue.post, function (response2)
                        {
                            if (response2 == 503)
                            {
                                callback(503);
                            }
                            else
                            {
                                returnValue.page = response2.page;

                                callback(returnValue);
                            }
                        });
                    });
                }
            }
        });
    });
}

/*
 Möjliga svar
 503

 false
 response.newPost = X;
 */
function newPostsExist(topicID, lastReadPostID, callback)
{
    var returnValue = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT * FROM forum_posts WHERE post_topic_id = ? AND post_id > ? AND post_hidden = 0 LIMIT 1",
            timeout: 30000,
            values: [topicID, lastReadPostID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                callback(503);
            }
            else
            {
                if (results.length > 0)
                {
                    returnValue.newPost = results[0].post_id;
                    callback(returnValue);
                }
                else
                {
                    callback(false);
                }
            }
        });
    });
}


/*
 Möjliga svar
 503

 response.page = X;
 */
function getPageFromPost(topicID, postID, callback)
{
    var response = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT COUNT(*) as count FROM forum_posts WHERE post_topic_id = ? AND post_id <= ? AND post_hidden = 0",
            timeout: 30000,
            values: [topicID, postID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                callback(503);
            }
            else
            {
                response.page = parseInt(Math.ceil(results[0].count / global.settings.posts_per_page));
                callback(response);
            }
        });
    });
}

/*
 Möjliga svar
 503
 404

 response.lastPage = X;
 */
function getLastPage(topicID, callback)
{
    var response = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT COUNT(*) as count FROM forum_posts WHERE post_topic_id = ? AND post_hidden = 0",
            timeout: 30000,
            values: [topicID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                callback(503);
            }
            else
            {
                if (results.length == 0)
                {
                    callback(404);
                }
                else
                {
                    response.lastPage = parseInt(Math.ceil(results[0].count / global.settings.posts_per_page));
                    callback(response);
                }
            }
        });
    });
}


/*
 Möjliga svar
 503
 404

 response.lastPost = X;
 */
function getLastPost(topicID, callback)
{
    var response = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT post_id FROM forum_posts WHERE post_topic_id = ? AND post_hidden = 0 ORDER BY post_id DESC LIMIT 1",
            timeout: 30000,
            values: [topicID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                callback(503);
            }
            else
            {
                if (results.length == 0)
                    callback(404);
                else
                {
                    response.lastPost = results[0].post_id;
                    callback(response);
                }
            }
        });
    });
}

/*
 canEditX KRÄVER
 topic_creator_id
 firstPost (om det är första posten i tråden)
 post_datetime
 post_user_id
 topic_locked
 board_locked
 topic_hidden
 post_hidden
 */

function canEditTopic(user, postID, postData, next)
{
    var currentTime = moment();

    async.parallel([
            function (callback)
            {
                if (user === null)
                {
                    return callback(true);
                }
                else if (user.permissions.topic_edit_all)
                {
                    callback();
                }
                else if (user.permissions.topic_edit_own && postData.topic_creator_id == user.user_id)
                {
                    if (user.permissions.topic_edit_own_time > 0)
                    {
                        var topicMaxEditTime = moment(postData.post_datetime).add(user.permissions.topic_edit_own_time, "m");

                        if (topicMaxEditTime.isSameOrAfter(currentTime))
                        {
                            callback();
                        }
                        else
                        {
                            return callback(true);
                        }
                    }
                    else
                    {
                        callback();
                    }
                }
                else
                {
                    return callback(true);
                }
            },
            function (callback)
            {
                if (postData.topic_locked == 1 && user.permissions.topic_lock == 0)
                {
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (postData.board_locked == 1 && user.permissions.board_lock == 0)
                {
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (postData.topic_hidden)
                {
                    if (user.permissions.topic_hide_all)
                    {
                        callback();
                    }
                    else if (user.permissions.topic_hide_own && postData.topic_creator_id == user.user_id)
                    {
                        if (user.permissions.topic_hide_own_time > 0)
                        {
                            var topicMaxHideTime = moment(postData.post_datetime).add(user.permissions.topic_hide_own_time, "m");

                            if (topicMaxHideTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
                else
                {
                    callback();
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });

}

function canEditPost(user, postID, postData, next)
{
    var currentTime = moment();

    async.parallel([
            function (callback)
            {
                if (user == null)
                {
                    return callback(true);
                }
                else if (postData.firstPost)
                {
                    if (user.permissions.topic_edit_all)
                    {
                        callback();
                    }
                    else if (user.permissions.topic_edit_own && postData.topic_creator_id == user.user_id)
                    {
                        if (user.permissions.topic_edit_own_time > 0)
                        {
                            var topicMaxEditTime = moment(postData.post_datetime).add(user.permissions.topic_edit_own_time, "m");

                            if (topicMaxEditTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
                else
                {
                    if (user.permissions.post_edit_all)
                    {
                        callback();
                    }
                    else if (user.permissions.post_edit_own && postData.post_user_id == user.user_id)
                    {
                        if (user.permissions.post_edit_own_time > 0)
                        {
                            var postMaxEditTime = moment(postData.post_datetime).add(user.permissions.post_edit_own_time, "m");

                            if (postMaxEditTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
            },
            function (callback)
            {
                if (postData.topic_locked == 1 && user.permissions.topic_lock == 0)
                {
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (postData.board_locked == 1 && user.permissions.board_lock == 0)
                {
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (postData.topic_hidden)
                {
                    if (user.permissions.topic_hide_all)
                    {
                        callback();
                    }
                    else if (user.permissions.topic_hide_own && postData.topic_creator_id == user.user_id)
                    {
                        if (user.permissions.topic_hide_own_time > 0)
                        {
                            var topicMaxHideTime = moment(postData.post_datetime).add(user.permissions.topic_hide_own_time, "m");

                            if (topicMaxHideTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (postData.post_hidden)
                {
                    if (user.permissions.post_hide_all)
                    {
                        callback();
                    }
                    else if (user.permissions.post_hide_own && postData.post_user_id == user.user_id)
                    {
                        if (user.permissions.post_hide_own_time > 0)
                        {
                            var postMaxHideTime = moment(postData.post_datetime).add(user.permissions.post_hide_own_time, "m");

                            if (postMaxHideTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
                else
                {
                    callback();
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });
}

function canDeletePost(user, post, next)
{
    var currentTime = moment();

    async.parallel([
            function (callback)
            {
                if (user.permissions.post_hide_all)
                {
                    callback();
                }
                else if (user.permissions.post_hide_own && post.post_user_id === user.user_id)
                {
                    if (user.permissions.post_hide_own_time > 0)
                    {
                        var postMaxHideTime = moment(post.post_datetime).add(user.permissions.post_hide_own_time, "m");

                        if (postMaxHideTime.isSameOrAfter(currentTime))
                        {
                            callback();
                        }
                        else
                        {
                            return callback(true);
                        }
                    }
                    else
                    {
                        callback();
                    }
                }
                else
                {
                    return callback(true);
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });
}

function canDeleteTopic(user, topic, next)
{
    var currentTime = moment();

    async.parallel([
            function (callback)
            {
                if (user.permissions.topic_hide_all)
                {
                    callback();
                }
                else if (user.permissions.topic_hide_own && topic.topic_creator_id === user.user_id)
                {
                    if (user.permissions.topic_hide_own_time > 0)
                    {
                        var topicMaxHideTime = moment(topic.topic_creation_date).add(user.permissions.topic_hide_own_time, "m");

                        if (topicMaxHideTime.isSameOrAfter(currentTime))
                        {
                            callback();
                        }
                        else
                        {
                            return callback(true);
                        }
                    }
                    else
                    {
                        callback();
                    }
                }
                else
                {
                    return callback(true);
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });
}

function canCreatePost (user, topicID, topicData, next)
{
    var currentTime = moment();

    async.parallel([
            function (callback)
            {
                if (topicData.topic_locked == 1 && user.permissions.topic_lock == 0)
                {
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (topicData.board_locked == 1 && user.permissions.board_lock == 0)
                {
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (topicData.topic_hidden)
                {
                    if (user.permissions.topic_hide_all)
                    {
                        callback();
                    }
                    else if (user.permissions.topic_hide_own && topicData.topic_creator_id == user.user_id)
                    {
                        if (user.permissions.topic_hide_own_time > 0)
                        {
                            var topicMaxHideTime = moment(topicData.topic_creation_date).add(user.permissions.topic_hide_own_time, "m");

                            if (topicMaxHideTime.isSameOrAfter(currentTime))
                            {
                                callback();
                            }
                            else
                            {
                                return callback(true);
                            }
                        }
                        else
                        {
                            callback();
                        }
                    }
                    else
                    {
                        return callback(true);
                    }
                }
                else
                {
                    callback();
                }
            }
        ],
        function (error, results)
        {
            if (error)
            {
                return next(false);
            }
            else
            {
                return next(true);
            }
        });

}

function hideReactions(postID, next)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "",
            timeout: 30000,
            values: []
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                return next(true);
            }
            else
            {

            }
        });
    });
}

module.exports = {
    getLastUnread: getLastUnread,
    canCreatePost: canCreatePost,
    canDeleteTopic: canDeleteTopic,
    canDeletePost: canDeletePost,
    canEditPost: canEditPost,
    canEditTopic: canEditTopic,
    getLastPage: getLastPage,
    getPageFromPost: getPageFromPost,
    newPostsExist: newPostsExist,
    hideReactions: hideReactions,
    getLastPost: getLastPost
};