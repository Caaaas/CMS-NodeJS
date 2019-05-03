var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var bcrypt = require('bcryptjs');
var async = require("async");
var fs = require("fs");
var nodemailer = require("nodemailer");
var randomstring = require("randomstring");
var logger = require.main.require('./utils/logger');

var smtpConfig = {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    requireTLS: process.env.MAIL_REQUIRE_TLS,
    debug: process.env.DEBUG
};

var transporter = nodemailer.createTransport(smtpConfig);

router.post('/skicka', function (req, res, next)
{
    if (typeof req.session.user !== "undefined")
    {
        res.sendStatus(403);
    }
    else
    {
        var username = req.body.username.trim();
        var email = req.body.email.trim();

        var returnObj = {};

        if (!username && !email)
            returnObj.error = "Du måste ange ditt användarnamn eller din mejl adress.";
        else if (username.length > 0 && email.length > 0)
            returnObj.error = "Vänligen ange antingen ditt användarnamn eller din mejl adress, inte båda.";

        if (isEmptyObject(returnObj))
        {
            if (username.length > 0)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)",
                        timeout: 30000,
                        values: [username]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            res.sendStatus(503);
                        }
                        else
                        {
                            if (results.length == 0)
                            {
                                returnObj.error = "Inget konto med det angivna användarnamnet hittades.";
                                res.send(returnObj);
                            }
                            else
                            {
                                returnObj.status = "OK";
                                returnObj.message = "Ett mejl med instruktioner om hur du återställer ditt lösenord har skickats ut till den mejl adress som är kopplad till det konto du angav.";
                                sendMail(results[0].user_id, function (response)
                                {
                                    if (response === true)
                                    {
                                        res.sendStatus(503);
                                    }
                                    else
                                    {
                                        res.send(returnObj);
                                    }
                                });
                            }
                        }
                    });
                });
            }
            else if (email.length > 0)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)",
                        timeout: 30000,
                        values: [email]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            res.sendStatus(503);
                        }
                        else
                        {
                            if (results.length == 0)
                            {
                                returnObj.error = "Inget konto med den angivna mejl adressen hittades.";
                                res.send(returnObj);
                            }
                            else
                            {
                                returnObj.status = "OK";
                                returnObj.message = "Ett mejl med instruktioner om hur du återställer ditt lösenord har skickats ut till den mejl adress du angav.";

                                transporter.sendMail(results[0].user_id, function (response)
                                {
                                    if (response === true)
                                    {
                                        res.sendStatus(503);
                                    }
                                    else
                                    {
                                        res.send(returnObj);
                                    }
                                });
                            }
                        }
                    });
                });
            }
            else
            {
                returnObj.error = "Ett internt fel uppstod, vänlig försök igen om ett litet tag.";
                res.send(returnObj);
            }

        }
        else
        {
            // Errors, avbryt, skicka tillbaka errorsen.
            res.send(returnObj);
        }
    }
});

function sendMail(user_id, callback)
{
    var email;
    var username;
    async.series([
            function (callback)
            {
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT email, username FROM users WHERE user_id = ?",
                        timeout: 30000,
                        values: [user_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            callback();
                            email = results[0].email;
                            username = results[0].username;
                        }
                    });
                });
            },
            function (callback)
            {
                var code = randomstring.generate({
                    length: 32,
                    charset: 'alphanumeric',
                    capitalization: 'uppercase'
                });

                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "INSERT INTO unique_codes SET user_id = ?, code = ?, type = ?",
                        timeout: 30000,
                        values: [user_id, code, "forgot"]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            return callback(true);
                        }
                        else
                        {
                            var emailData;
                            var emailReplaced;

                            fs.readFile(process.cwd() + '/views/emails/forgot-password.ejs', 'utf-8', function (error, data)
                            {
                                if (error)
                                {
                                    logger.info(error);
                                    return callback(true);
                                }
                                else
                                {
                                    // $name
                                    // $link_button
                                    // $link_normal_if
                                    // $link_if_not_work
                                    // $link_if_not_work_text

                                    var activateLink = "https://" + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + "/glomt-losenord/" + email + "/" + code;
                                    emailData = data;
                                    emailReplaced = emailData.replace("$name", username)
                                        .replace("$link_button", activateLink)
                                        .replace("$link_normal_if", activateLink)
                                        .replace("$link_if_not_work", activateLink)
                                        .replace("$link_if_not_work_text", activateLink)
                                        .replace('$websiteName', process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END)
                                        .replace('$websiteName', process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END);

                                    var mailOptions = {
                                        from: process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + ' <' + process.env.MAIL_NO_REPLY + '>',
                                        to: email,
                                        subject: process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + " - Återställning av lösenord",
                                        text: 'Hej ' + username + '\n\nDu har fått det här mailet för att du begärt ett nytt lösenord för att kunna logga in på ' + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + '\n\nOm du inte har begärt ett nytt lösenord så kan du ignorera detta mejl.\n\nFör att ändra ditt lösenord, kopiera länken nedan och klistra sedan in den i valfri webbläsare.\n\n' + activateLink + '\n\nMed vänliga hälsningar,\n' + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END,
                                        html: emailReplaced
                                    };

                                    transporter.sendMail(mailOptions, function (error, info)
                                    {
                                        if (error)
                                        {
                                            logger.info(error);
                                            return callback(true);
                                        }
                                        else
                                        {
                                            callback();
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            }
        ],
        function (error, result)
        {
            if (error)
            {
                return callback(true);
            }
            else
            {
                return callback();
            }

        });
}


router.post('/uppdatera', function (req, res, next)
{
    if (typeof req.session.user !== "undefined")
    {
        res.sendStatus(403);
    }
    else
    {
        var salt = bcrypt.genSaltSync(10);
        var userID;
        var returnObj = {};

        var password = req.body.password.trim();
        var email = req.body.email.trim();
        var code = req.body.code.trim();

        if (!email || email.length <= 0)
        {
            returnObj.error = "Länken ser inte ut att stämma. Vänligen kopiera och klistra in den exakta länken i din webbläsare.";
            res.send(returnObj);
        }
        else if (!code || code.length <= 0)
        {
            returnObj.error = "Länken ser inte ut att stämma. Vänligen kopiera och klistra in den exakta länken i din webbläsare.";
            res.send(returnObj);
        }
        else if (!password || password.length <= 0)
        {
            returnObj.error = "Du måste ange ditt nya lösenord.";
            res.send(returnObj);
        }
        else if (password.length < 6)
        {
            returnObj.error = "Ditt lösenord måste vara minst 6 bokstäver långt.";
            res.send(returnObj);
        }
        else
        {
            async.series([
                    function (callback)
                    {
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)",
                                timeout: 30000,
                                values: [email]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
                                    return callback(true);
                                }
                                else
                                {
                                    if (results.length == 0)
                                    {
                                        returnObj.error = "Ingen användare med de angivna uppgifterna existerar.";
                                        res.send(returnObj);
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
                                values: [userID, code, "forgot"]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
                                    return callback(true);
                                }
                                else
                                {
                                    if (results[0].count == 0)
                                    {
                                        returnObj.error = "Koden och mejl adressen stämmer inte överens. Kontrollera att du följt den korrekta länken i mejlet som skickades till dig.";
                                        res.send(returnObj);
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
                        var encryptedPassword = bcrypt.hashSync(password, salt);
                        db.getForumConnection(function (err, connection)
                        {
                            connection.query({
                                sql: "UPDATE users SET password = ? WHERE user_id = ?",
                                timeout: 30000,
                                values: [encryptedPassword, userID]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
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
                                sql: "DELETE sessions, " +
                                "sessions_users " +
                                "FROM sessions " +
                                "INNER JOIN sessions_users ON sessions_users.su_session_id = sessions.session_id " +
                                "WHERE sessions_users.su_session_user_id = ?",
                                timeout: 30000,
                                values: [userID]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
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
                                values: [userID, code, "forgot"]
                            }, function (error, results)
                            {
                                connection.release();
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
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
                    if (error)
                    {
                        // Hanteras separat
                    }
                    else
                    {
                        res.sendStatus(200);
                    }
                });
        }
    }
});

router.get('*', function (req, res, next)
{
    if (typeof req.session.user !== "undefined")
    {
        var resErr = new Error();
        resErr.status = 403;
        next(resErr);
        return next(true);
    }
    else
    {
        var parts = req.path.split("/");
        var userID;
        var username;
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
                            sql: "SELECT user_id, username FROM users WHERE LOWER(email) = LOWER(?)",
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
                                else
                                {
                                    userID = results[0].user_id;
                                    username = results[0].username;
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
                            values: [userID, code, "forgot"]
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
                }
            ],
            function (error, result)
            {
                function render()
                {
                    res.render('forgot_password', {
                        session: req.session,
                        chat: req.chat,
                        returnError: returnError,
                        username: username
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
                        render();
                    }
                }
                else
                {
                    // Skicka!
                    render();
                }

            });
    }
});

function isEmptyObject(obj)
{
    for (var key in obj)
    {
        if (Object.prototype.hasOwnProperty.call(obj, key))
        {
            return false;
        }
    }
    return true;
}

module.exports = router;
