var mysql = require("mysql");
var logger = require.main.require('./utils/logger');

var dbOptions = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DB,
    connectionLimit: process.env.DB_CONN_LIMIT
};

var poolForum = mysql.createPool(dbOptions);

exports.getForumConnection = function (callback)
{
    poolForum.getConnection(function (error, conn)
    {
        if (error)
        {
            logger.info(error);
            return callback(error);
        }
        else
        {
            callback(error, conn);
        }
    });
};

exports.dbOptions = dbOptions;
exports.poolForum = poolForum;

/*
 var conectionsInUse = 0;
 poolForum.on('connection', function(connection) {
 console.log('Connected to MySql db');
 conectionsInUse++;
 console.log("Open cons: " + conectionsInUse)
 });

 poolForum.on('acquire', function(connection) {
 console.log('Aquired to MySql db');
 conectionsInUse++;
 console.log("Open cons: " + conectionsInUse)
 });

 poolForum.on('release', function (connection) {
 console.log('Releaseed to MySql db');
 conectionsInUse--;
 console.log("Open cons: " + conectionsInUse)
 });

 poolForum.on('enqueue', function () {
 console.log('Enque to MySql db');
 console.log("Open cons: " + conectionsInUse)
 });*/