var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            json: true,
            timestamp: true
        }),
        new winston.transports.File({
            filename: __dirname + '/debug.log',
            json: true
        })
    ],
    exceptionHandlers: [
        new (winston.transports.Console)({
            json: true,
            timestamp: true
        }),
        new winston.transports.File({
            filename: __dirname + '/exceptions.log',
            json: true
        })
    ],
    exitOnError: false
});

module.exports = logger;

/*

var logger = require.main.require('./logger');

logger.info("Försökte hämta flera boards som inte finns. User = " + req.session.user);
res.sendStatus(503);
return callback(true);

*/