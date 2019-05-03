var async = require("async");
var mysql = require('mysql');
var db = require.main.require('./utils/databases');
var moment = require('moment');
var functions = require.main.require('./utils/functions/chat');
var logger = require.main.require('./utils/logger');

exports = module.exports = function (io)
{
    io.sockets.on('connection', function (socket)
    {
        socket.on('chat edit message', function (data)
        {
            if (typeof socket.handshake.session.user !== 'undefined')
            {
                var userData;
                if (typeof socket.handshake.session.user !== 'undefined')
                    userData = socket.handshake.session.user;
                else
                    userData = null;

                var newMessage;
                var messageID;
                var chatData;
                async.series([
                    function (callback)
                    {
                        var startTime = moment().format("YYYY-MM-DD HH:mm:ss");

                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT * FROM chat_bans WHERE chat_ban_user_id = ? AND chat_ban_end > ?",
                                timeout: 30000,
                                values: [socket.handshake.session.user.user_id, startTime]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Error vid hämtning av Chat Bans för user  = " + JSON.stringify(socket.handshake.session.user));
                                    socket.emit("chat edit message info", "Internt server fel, försök igen om ett tag.");
                                    return callback(true);
                                }
                                else
                                {
                                    // Om vi hittar, är usern bannad och får inte edita
                                    if (results.length > 0)
                                    {
                                        socket.emit("chat edit message info", "Lägg ner vafan!");
                                        return callback(true);
                                    }
                                    else
                                    {
                                        callback();
                                    }
                                }
                            });
                        });
                    },
                    function (callback)
                    {
                        if (data.message_new.trim().length > 140)
                        {
                            socket.emit("chat edit message info", "Ditt meddelande får max vara 140 tecken långt.");
                            return callback(true);
                        }
                        else
                        {
                            newMessage = data.message_new.trim();
                            callback();
                        }
                    },
                    function (callback)
                    {
                        if (data.message_new.trim().length < 3)
                        {
                            socket.emit("chat edit message info", "Ditt meddelande måste vara minst 3 tecken långt.");
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    },
                    function (callback)
                    {
                        if (data.message_id.lastIndexOf("-") > -1)
                        {
                            messageID = parseInt(data.message_id.substr(data.message_id.lastIndexOf("-") + 1, data.message_id.length));
                        }
                        else
                        {
                            messageID = parseInt(data.message_id);
                        }
                        if (typeof messageID !== "number" || isNaN(messageID))
                        {
                            logger.info("Försökte edita chat msg utan chatID. User = " + socket.handshake.session.user);
                            socket.emit("chat edit message info", "Lägg ner vafan!");
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    },
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT * FROM chat WHERE chat_id = ?",
                                timeout: 30000,
                                values: [messageID]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Kunde inte hitta någon med angivna chatt ID't = " + messageID + "..." + JSON.stringify(socket.handshake.session.user));
                                    socket.emit("chat edit message info", "Lägg ner vafan!");
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
                        functions.canEditChat(userData, chatData, function (response)
                        {
                            if (response === false)
                            {
                                socket.emit("chat edit message info", "Du har inte rättigheter att redigera detta meddelande.");
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
                                sql: "UPDATE chat SET chat_message = ? WHERE chat_id = ?",
                                timeout: 30000,
                                values: [newMessage, messageID]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info("Kunde inte uppdatera chattmeddelande. " + messageID + "..." + JSON.stringify(socket.handshake.session.user));
                                    socket.emit("chat edit message info", "Internt fel, försök igen om ett tag.");
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
                    }
                    else
                    {
                        var returnData = {};
                        returnData.id = messageID;
                        returnData.new_message = newMessage;
                        socket.emit('chat edit message info', "success");
                        io.sockets.emit('edited message', returnData);
                    }
                });
            }
            else
            {
                socket.emit("noPermission");
            }
        });
    });
}