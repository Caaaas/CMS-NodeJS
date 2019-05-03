var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var async = require("async");
var logger = require.main.require('./utils/logger');

router.get('/*', function (req, res, next)
{
    var parts = req.path.split("/");
    var userID;
    var returnError = null;

    var email;
    var code;

    async.series([
            function (callback)
            {
                if (parts.length !== 3 || parts[1].length <= 0 || parts[2].length <= 0)
                {
                    returnError = "Länken ser inte ut att stämma. Vänligen kopiera och klistra in den exakta länken i din webbläsare.";
                    return callback(true);
                }
                else
                {
                    email = parts[1];
                    code = parts[2];
                    callback();
                }
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT user_id, active FROM users WHERE LOWER(email) = LOWER(?)",
                        timeout: 30000,
                        values: [email]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            next(resErr);
                            return callback(true);
                        }
                        else
                        {
                            if (results.length == 0)
                            {
                                returnError = "Ingen användare med de angivna uppgifterna existerar.";
                                return callback(true);
                            }
                            else if (results[0].active == 1)
                            {
                                returnError = "Detta konto är redan aktivt.";
                                return callback(true);
                            }
                            else
                            {
                                userID = results[0].user_id;
                                callback();
                            }
                        }
                    });
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT COUNT(*) AS count FROM unique_codes WHERE user_id = ? AND code = ? AND type = ?",
                        timeout: 30000,
                        values: [userID, code, "register"]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            next(resErr);
                            return callback(true);
                        }
                        else
                        {
                            if (results[0].count == 0)
                            {
                                returnError = "Koden och mejl adressen stämmer inte överens. Kontrollera att du följt den korrekta länken i mejlet som skickades till dig.";
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
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "UPDATE users SET active = ? WHERE user_id = ?",
                        timeout: 30000,
                        values: [1, userID]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            next(resErr);
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "DELETE FROM unique_codes WHERE user_id = ? AND code = ? AND type = ?",
                        timeout: 30000,
                        values: [userID, code, "register"]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            next(resErr);
                            return callback(true);
                        }
                        else
                        {
                            callback();
                        }
                    });
                });
            }
        ],
        function (error, result)
        {
            function render()
            {
                res.render('activate_account', {
                    session: req.session,
                    chat: req.chat,
                    returnError: returnError
                });
            }
            if (error)
            {
                // Hanteras separat
                if (returnError == null)
                {
                    // Nada, hanteras separat, annars rendera.!
                }
                else
                {
                    // Vi har då fått ett "manuellt" skapat fel, och vill visa detta. Rendrar och tar hand om det i .ejs
                    render();
                }
            }
            else
            {
                // Skicka!
                render();
            }

        });
});

module.exports = router;
