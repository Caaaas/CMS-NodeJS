var logger = require.main.require('./utils/logger');
var db = require.main.require('./utils/databases');
var requestIP = require('request-ip');

function getIP(req, res, callback)
{
    if (typeof req.session.user !== 'undefined')
    {
        var userIP = requestIP.getClientIp(req);
        var datetime = new Date();
        db.getForumConnection(function (err, connection)
        {
            connection.query({
                sql: 'SELECT ip_id FROM user_ip WHERE ip_user_id = ? AND ip_ip = ?',
                timeout: 30000,
                values: [req.session.user.user_id, userIP]
            }, function (error, results, fields)
            {
                connection.release();
                if (error)
                {
                    logger.info(error);
                    var resErr = new Error();
                    resErr.status = 503;
                    callback(resErr);
                }
                else
                {
                    if (results.length > 0)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'UPDATE user_ip SET ip_last_used = ? WHERE ip_id = ?',
                                timeout: 30000,
                                values: [datetime, results[0].ip_id]
                            }, function (error, results, fields)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    var resErr = new Error();
                                    resErr.status = 503;
                                    callback(resErr);
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
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: 'INSERT INTO user_ip SET ip_user_id = ?, ip_ip = ?, ip_last_used = ?',
                                timeout: 30000,
                                values: [req.session.user.user_id, userIP, datetime]
                            }, function (error, results, fields)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    var resErr = new Error();
                                    resErr.status = 503;
                                    callback(resErr);
                                }
                                else
                                {
                                    callback();
                                }
                            });
                        });
                    }
                }
            });
        });
    }
    else
    {
        callback();
    }
}

module.exports = {
    getIP: getIP
}