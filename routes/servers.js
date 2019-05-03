var express = require('express');
var router = express.Router();
var gamedig = require('gamedig');
var async = require("async");
var db = require.main.require('./utils/databases');
var logger = require.main.require('./utils/logger');

var serverPorts;

setInterval(function () {
    db.getForumConnection(function (err, connection) {
        connection.query({
            sql: 'SELECT server_port FROM servers',
            timeout: 30000
        }, function (error, results, fields) {
            connection.release();
            if (error)
            {
                // Hantera felet
                logger.info(error);
            }
            else
            {
                serverPorts = results.map(function (item) {
                    return item.server_port;
                });
            }
        });
    });

    async.eachOf(serverPorts, function (port, index, nextInner) {
        gamedig.query({
                type: 'csgo',
                host: process.env.SERVER_FULL_DOMAIN,
                port: port
            },
            function (error, state) {
                if (error)
                {
                    db.getForumConnection(function (port, err, connection) {
                        connection.query({
                            sql: 'UPDATE servers SET server_status = 0 WHERE server_port = ?',
                            timeout: 30000,
                            values: [port]
                        }, function (error, results, fields) {
                            connection.release();
                            if (error)
                            {
                                // Hantera felet
                                logger.info(error);
                            }
                            else
                            {
                                nextInner();
                            }
                        });
                    }.bind(db, port));
                }
                else
                {
                    db.getForumConnection(function (port, err, connection) {
                        connection.query({
                            sql: 'UPDATE servers ' +
                            'SET server_status = 1, ' +
                            'server_name = ?, ' +
                            'server_players_max = ?, ' +
                            'server_players_current = ?, ' +
                            'server_map = ?, ' +
                            'server_port = ? ' +
                            'WHERE server_port = ? ',
                            timeout: 30000,
                            values: [state.name, state.maxplayers, state.raw.numplayers, state.map, port, port]
                        }, function (error, results, fields) {
                            connection.release();
                            if (error)
                            {
                                // Hantera felet
                                logger.info(error);
                            }
                            else
                            {
                                nextInner();
                            }
                        });
                    }.bind(db, port));
                }
            });
    }, function (error) {
        if (error)
        {
            logger.info(error);
        }
        else
        {
        }
    });
}, 60000);


router.get('/*', function (req, res, next) {
    var resultServers = [];
    db.getForumConnection(function (err, connection) {
        connection.query({
            sql: 'SELECT * FROM servers ORDER BY server_order ASC',
            timeout: 30000
        }, function (error, results, fields) {
            connection.release();
            if (error)
            {
                // Hantera felet
                logger.info(error);
                res.sendStatus(503);
                next();
            }
            else
            {
                res.render('servers', {
                    session: req.session,
                    servers: results,
                    chat: req.chat
                });
            }
        });
    });
});

module.exports = router;