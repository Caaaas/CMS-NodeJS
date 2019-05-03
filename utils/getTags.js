var db = require.main.require('./utils/databases');
var logger = require.main.require('./utils/logger');

module.exports = {
    getTags: function (topic, callback)
    {
        db.getForumConnection(function (err, connection)
        {
            connection.query({
                sql:
                    "SELECT " +
                    "ftt_tag_id, " +
                    "t1.* " +
                    "FROM forum_topics_tags " +
                    "LEFT JOIN forum_tags t1 ON t1.tag_id = forum_topics_tags.ftt_tag_id " +
                    "WHERE ftt_topic_id = ?",
                timeout: 30000,
                values: [topic.topic_id]
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
                    topic.topic_tags = results;
                    callback();
                }
            });
        });
    }
};