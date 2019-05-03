var async = require("async");
var mysql = require('mysql');
var db = require.main.require('./utils/databases');
var perms = require.main.require('./utils/getPermissions');
var moment = require('moment');
var functions = require.main.require('./utils/functions/chat');
var logger = require.main.require('./utils/logger');

exports = module.exports = function (io)
{
    io.sockets.on('connection', function (socket)
    {
        socket.on('chat user ban', function (data)
        {
            var userData;
            if (typeof socket.handshake.session.user !== 'undefined')
                userData = socket.handshake.session.user;
            else
                userData = null;

            var banTime = parseInt(data.time);
            var banUserID = null;
            async.series([
                function (callback)
                {
                    if (userData === null)
                    {
                        socket.emit("chat user banned", "Lägg ner vafan.");
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                },
                function (callback)
                {
                    if (typeof banTime !== "number" || isNaN(banTime))
                    {
                        logger.info("Försöker chattbanna utan tid -> User = " + JSON.stringify(socket.handshake.session.user, null, 4));
                        socket.emit("chat user banned", "Du måste ange längd på bannen.");
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                },
                function (callback)
                {
                    if (data.user_id.lastIndexOf("-") > -1)
                    {
                        banUserID = parseInt(data.user_id.substr(data.user_id.lastIndexOf("-") + 1, data.user_id.length));
                    }
                    else
                    {
                        banUserID = parseInt(data.user_id);
                    }
                    if (typeof banUserID !== "number" || isNaN(banUserID))
                    {
                        logger.info("Försöker chattbanna utan ange user -> User = " + JSON.stringify(req.session.user, null, 4));
                        socket.emit("chat user banned", "Lägg ner vafan.");
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                },
                function (callback)
                {
                    if (userData.permissions.chat_ban)
                    {
                        callback();
                    }
                    else
                    {
                        socket.emit("chat user banned", "Lägg ner vafan.");
                        return callback(true)
                    }
                },
                function (callback)
                {
                    var dateNow = moment().format("YYYY-MM-DD HH:mm:ss");
                    var dateEnd = moment().add(banTime, 'minutes').format("YYYY-MM-DD HH:mm:ss");

                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "INSERT INTO chat_bans SET chat_ban_user_id = ?, chat_ban_start = ?, chat_ban_end = ?, chat_ban_by = ?",
                            timeout: 30000,
                            values: [banUserID, dateNow, dateEnd, userData.user_id]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info("Fel vid insert i databas chatban -> User = " + JSON.stringify(userData, null, 4));
                                socket.emit("chat user banned", "Internt fel, försök igen om ett tag.");
                                return callback(true);
                            }
                            else
                            {
                                callback();
                            }
                        });
                    });
                }
            ], function (error)
            {
                if (error)
                {
                    // Hanteras enskilt
                }
                else
                {
                    socket.emit('chat user banned', "success");
                    socket.emit('chat user banned global', banUserID);
                }
            });
        });
    });
};