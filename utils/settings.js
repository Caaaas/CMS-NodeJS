var db = require.main.require('./utils/databases');

function getSettings(req, res, callback)
{
    global.settings = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: 'SELECT * FROM settings',
            timeout: 30000
        }, function (error, results, fields)
        {
            connection.release();
            if (error)
            {
                // Hantera felet
                logger.info(error);
                res.sendStatus(503);
                return callback(true);
            }
            else
            {
                global.settings.groups_in_staff = results[0]['groups_in_staff'].split(",").map(Number);
                global.settings.news_board_id = results[0]['news_board_id'];
                global.settings.news_amount = results[0]['news_amount'];
                global.settings.posts_amount = results[0]['posts_amount'];
                global.settings.posts_per_page = results[0]['posts_per_page'];
                global.settings.topics_per_page = results[0]['topics_per_page'];
                global.settings.user_default_group = results[0]['user_default_group'];
                callback();
            }
        });
    });
}

function getSettingsStart()
{
    global.settings = {};
    db.getForumConnection(function (err, connection)
    {
        connection.query({
            sql: 'SELECT * FROM settings',
            timeout: 30000
        }, function (error, results, fields)
        {
            connection.release();
            if (error)
            {
                // Hantera felet
                logger.info(error);
            }
            else
            {
                global.settings.groups_in_staff = results[0]['groups_in_staff'].split(",").map(Number);
                global.settings.news_board_id = results[0]['news_board_id'];
                global.settings.news_amount = results[0]['news_amount'];
                global.settings.posts_amount = results[0]['posts_amount'];
                global.settings.posts_per_page = results[0]['posts_per_page'];
                global.settings.topics_per_page = results[0]['topics_per_page'];
                global.settings.user_default_group = results[0]['user_default_group'];
            }
        });
    });
}


module.exports = {
    getSettings: getSettings,
    getSettingsStart: getSettingsStart
}