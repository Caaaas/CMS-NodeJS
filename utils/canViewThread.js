var db = require.main.require('./utils/databases');
var forumAccess = require.main.require('./utils/canViewForum');
var logger = require.main.require('./utils/logger');

module.exports = {
    canViewThread: function (boardID, threadID, userData, callback)
    {
        forumAccess.canViewForum(boardID, userData, function (response)
        {
            if (response === false)
                return callback(false);
            else
            {
                canView(threadID, userData, function (responseInner)
                {
                    if (responseInner === false)
                        return callback(false);
                    else
                        return callback(response)
                });
            }
        });
    }
};

function canView(threadID, userData, callback)
{
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: "SELECT * FROM forum_topics WHERE topic_id = ?",
            timeout: 30000,
            values: [threadID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                return callback(false);
            }
            else
            {
                if (results[0].topic_hidden === 1)
                {
                    if (userData !== null)
                    {
                        if (userData.permissions.forum_hidden_view)
                            return callback(true);
                        else
                            return callback(false);

                    }
                    else
                        return callback(false);
                }
                else
                    return callback(true);
            }
        });
    });
}