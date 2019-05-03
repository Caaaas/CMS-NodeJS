var async = require("async");
var mysql = require('mysql');
var db = require.main.require('./utils/databases');
var perms = require.main.require('./utils/getPermissions');
var functions = require.main.require('./utils/functions/chat');
var moment = require('moment');

exports = module.exports = function (io)
{
    io.sockets.on('connection', function (socket)
    {
        socket.on('delete message', function (data)
        {
            if (typeof socket.handshake.session.user !== 'undefined')
            {
                var id = parseInt(data.split("chat-message-")[1]);
                var chatData;
                if (typeof id === 'number' && (id % 1) === 0)
                {
                    async.series([
                        function (callback)
                        {
                            db.getForumConnection(function (err, connection)
                            {
                                connection.query({
                                    sql: "SELECT * FROM chat WHERE chat_id = ?",
                                    timeout: 30000,
                                    values: [id]
                                }, function (error, results)
                                {
                                    connection.release();
                                    if (error)
                                    {
                                        logger.info("Kudne inte hitta chat_id = " + JSON.stringify(id));
                                        var resErr = new Error();
                                        resErr.status = 503;
                                        return callback(true);
                                    }
                                    else
                                    {
                                        chatData = results[0];
                                        callback();
                                    }
                                });
                            });
                        },
                        function (callback)
                        {
                            functions.canDeleteChat(socket.handshake.session.user, chatData, function (response)
                            {
                                if (response === false)
                                {
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
                                    sql: "UPDATE chat SET chat_hidden = 1 WHERE chat_id = ?",
                                    timeout: 30000,
                                    values: [id]
                                }, function (error, results)
                                {
                                    connection.release();
                                    if (error)
                                    {
                                        logger.info("Kudne deletea chat = " + JSON.stringify(id));
                                        var resErr = new Error();
                                        resErr.status = 503;
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
                            // Hantera felet
                            socket.emit("noPermission");
                            throw error;
                        }
                        else
                        {
                            io.sockets.emit('removed message', id);
                        }
                    });
                }
                else
                {
                    socket.emit("noPermission");
                }
            }
            else
            {
                socket.emit("noPermission");
            }
        });
    });
}