var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var bcrypt = require('bcryptjs');
var logger = require.main.require('./utils/logger');

router.post('/', function (req, res, next)
{
    var username = req.body.username.trim();
    var password = req.body.password.trim();
    var rememberMe = req.body.rememberme;

    var errorObj = {};

    if (!username)
        errorObj.username = "Du måste ange ett användarnamn";
    if (!password)
        errorObj.password = "Du måste ange ett lösenord";

    if (isEmptyObject(errorObj))
    {
        db.getForumConnection(function (err, connection)
        {
            connection.query({
                sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
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
                    // Success
                    if (!results.length)
                    {
                        errorObj.username = "Ingen användare med det angiva användarnamnet existerar";
                        res.send(errorObj);
                    }
                    else
                    {
                        if (results[0].active == 0)
                        {
                            errorObj.username = "Detta konto är inte aktiverat.";
                            res.send(errorObj);
                        }
                        else
                        {

                            bcrypt.compare(password, results[0].password, function (error, bres)
                            {
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
                                }
                                else if (bres)
                                {
                                    req.session.user = {};
                                    req.session.user.user_id = results[0].user_id;

                                    if (rememberMe === true)
                                    {
                                        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dagar
                                    }
                                    else
                                    {
                                        req.session.cookie.expires = false; // Håller sessionen ut
                                    }

                                    res.sendStatus(200);
                                }
                                else
                                {
                                    errorObj.username = "Användarnamnet och lösenordet matchar inte";
                                    res.send(errorObj);
                                }
                            });
                        }
                    }
                }
            });
        });
    }
    else
    {
        // Errors, avbryt, skicka tillbaka errorsen.
        res.send(errorObj);
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
