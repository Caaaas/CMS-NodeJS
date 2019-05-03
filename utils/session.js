var db = require.main.require('./utils/databases');

function connectSession(req, res, callback)
{
    res.locals.session = req.session;
    if (typeof req.session.user !== 'undefined')
    {
        db.getForumConnection(function (err, connection)
        {
            connection.query({
                sql: 'INSERT INTO sessions_users (su_session_id, su_session_user_id) ' +
                'VALUES(?, ?) ' +
                'ON DUPLICATE KEY UPDATE su_session_id = ?, su_session_user_id = ?',
                timeout: 30000,
                values: [req.session.id, req.session.user.user_id, req.session.id, req.session.user.user_id]
            }, function (error, results, fields)
            {
                connection.release();
                if (error)
                {
                    // Hantera felet
                    logger.info(error);
                    var resErr = new Error(error);
                    resErr.status = 503;
                    callback(resErr);
                }
                else
                {
                    callback();
                }
            })
        });
    }
    else
    {
        callback();
    }
}

module.exports = {
    connectSession: connectSession
}