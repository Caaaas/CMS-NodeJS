var express = require('express');
var router = express.Router();
var async = require('async');
var bcrypt = require('bcryptjs');
var fs = require("fs");
var logger = require.main.require('./utils/logger');
var db = require.main.require('./utils/databases');
var steam = require('steam-login');

router.use(steam.middleware(
    {
        realm: 'https://' + process.env.WEBSITE_NAME.toLowerCase() + process.env.WEBSITE_DOMAIN_END + '/',
        verify: 'https://' + process.env.WEBSITE_NAME.toLowerCase() + process.env.WEBSITE_DOMAIN_END + '/profil/steam-verify',
        apiKey: process.env.STEAM_API_KEY
    }
));


router.post('/ladda-up-bild', function (req, res, next)
{
    var data = req.body.image;
    var imageData;
    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    async.series([
            function (callback)
            {
                if (userData == null)
                {
                    res.sendStatus(403);
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                decodeBase64Image(data, function (response)
                {
                    if (response == false)
                    {
                        // Error med att parsea bilden
                        logger.info("Error gällande parsing av fil. = " + req.session.user);
                        res.sendStatus(503);
                        return callback(true);
                    }
                    else
                    {
                        // Får ladda upp.
                        imageData = response;
                        callback();
                    }
                })
            },
            function (callback)
            {
                var fileDirectory = process.cwd() + '/public/uploads/profile-pictures/' + userData.user_id + '.png';
                fs.writeFile(fileDirectory, imageData.data, function (error)
                {
                    if (error)
                    {
                        logger.info("Error när profilbild fil skulle skapas. = " + req.session.user + error);
                        res.sendStatus(503);
                        return callback(true);
                    }
                    else
                    {
                        callback();
                    }
                });
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras separat.
            }
            else
            {
                res.sendStatus(200);
            }
        }
    )
});

router.post('/byt-losenord', function (req, res, next)
{
    var salt = bcrypt.genSaltSync(10);
    var password_old = req.body.password_old.trim();
    var password_new = req.body.password_new.trim();

    var userData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    var errorObj = {};
    errorObj.code = "custom";

    async.series([
            function (callback)
            {
                if (userData == null)
                {
                    res.sendStatus(403);
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (!password_old || !password_new)
                {
                    errorObj.message = "Du måste ange ditt gamla och nya lösenord.";
                    res.send(errorObj);
                    return callback(true);
                }
                else if (password_new.length < 6)
                {
                    errorObj.message = "Ditt lösenord måste vara minst 6 bokstäver långt.";
                    res.send(errorObj);
                    return callback(true);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                var encryptedPasswordNew = bcrypt.hashSync(password_new, salt);
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT password FROM users WHERE user_id = ?",
                        timeout: 30000,
                        values: [userData.user_id]
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
                            bcrypt.compare(password_old, results[0].password, function (error, bres)
                            {
                                if (error)
                                {
                                    logger.info(error);
                                    res.sendStatus(503);
                                }
                                else if (bres)
                                {
                                    db.getForumConnection(function (err, connection)
                                    {
                                        connection.query({
                                            sql: "UPDATE users SET password = ? WHERE user_id = ?",
                                            timeout: 30000,
                                            values: [encryptedPasswordNew, userData.user_id]
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
                                                db.getForumConnection(function (err, connection)
                                                {
                                                    connection.query({
                                                        sql: "DELETE sessions, " +
                                                        "sessions_users " +
                                                        "FROM sessions " +
                                                        "INNER JOIN sessions_users ON sessions_users.su_session_id = sessions.session_id " +
                                                        "WHERE sessions_users.su_session_user_id = ?",
                                                        timeout: 30000,
                                                        values: [userData.user_id]
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
                                            }
                                        });
                                    });
                                }
                                else
                                {
                                    errorObj.message = "Det gamla lösenordet stämmer inte.";
                                    res.send(errorObj);
                                }
                            });
                        }
                    });
                });
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras separat.
            }
            else
            {
                res.sendStatus(200);
            }
        }
    )
});

router.get('/steam-login', steam.authenticate(), function (req, res)
{
    res.redirect('/');
});

router.get('/steam-verify', steam.verify(), function (req, res, outerNext)
{
    var usersAll;
    var usersThis;
    async.series([
            function (callback)
            {
                if (typeof req.session.user === 'undefined')
                {
                    var resErr = new Error();
                    resErr.status = 403;
                    return callback(resErr);
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                // Kolla om usern redan är kopplad
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT * FROM user_steam WHERE steamid = ? AND user_id = ?",
                        timeout: 30000,
                        values: [req.user.steamid, req.session.user.user_id]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            return callback(resErr);
                        }
                        else
                        {
                            usersThis = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                // Kolla om usern redan är kopplad
                db.getForumConnection(function (err, connection)
                {
                    connection.query({
                        sql: "SELECT * FROM user_steam WHERE steamid = ?",
                        timeout: 30000,
                        values: [req.user.steamid]
                    }, function (error, results)
                    {
                        connection.release();
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 503;
                            return callback(resErr);
                        }
                        else
                        {
                            usersAll = results;
                            callback();
                        }
                    });
                });
            },
            function (callback)
            {
                if (usersThis.length > 0)
                {
                    async.each(usersThis, function (user, next)
                    {
                        if (user.active === 1)
                        {
                            return next(true);
                        }
                        else
                        {
                            next();
                        }
                    }, function (error)
                    {
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 403;
                            return callback(resErr);
                        }
                        else
                        {
                            callback();
                        }
                    });
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                if (usersAll.length > 0)
                {
                    async.each(usersAll, function (user, next)
                    {
                        if (user.active === 1)
                        {
                            return next(true);
                        }
                        else
                        {
                            next();
                        }
                    }, function (error)
                    {
                        if (error)
                        {
                            logger.info(error);
                            var resErr = new Error();
                            resErr.status = 403;
                            return callback(resErr);
                        }
                        else
                        {
                            callback();
                        }
                    });
                }
                else
                {
                    callback();
                }
            },
            function (callback)
            {
                // Finns en user, men inte aktiv
                if (usersThis.length > 0)
                {
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "UPDATE user_steam SET username = ?, profile_url = ?, avatar_large = ?, active = 1 WHERE user_id = ? AND steamid = ?",
                            timeout: 30000,
                            values: [req.user.username, req.user.profile, req.user.avatar.large, req.session.user.user_id, req.user.steamid]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                var resErr = new Error();
                                resErr.status = 503;
                                return callback(resErr);
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
                    // Finns ingen user med detta, skapar ny
                    db.getForumConnection(function (err, connection)
                    {
                        connection.query({
                            sql: "INSERT INTO user_steam SET user_id = ?, steamid = ?, username = ?, profile_url = ?, avatar_large = ?",
                            timeout: 30000,
                            values: [req.session.user.user_id, req.user.steamid, req.user.username, req.user.profile, req.user.avatar.large]
                        }, function (error, results)
                        {
                            connection.release();
                            if (error)
                            {
                                logger.info(error);
                                var resErr = new Error();
                                resErr.status = 503;
                                return callback(resErr);
                            }
                            else
                            {
                                callback();
                            }
                        });
                    });
                }
            }
        ],
        function (error)
        {
            if (error)
            {
                return outerNext(error)
            }
            else
            {
                res.redirect('/profil')
            }
        });
});

router.get('/steam-logout', steam.enforceLogin('/'), function (req, res)
{
    if (typeof req.session.user !== 'undefined')
    {
        db.getForumConnection(function (err, connection)
        {
            connection.query({
                sql: "UPDATE user_steam SET active = 0 WHERE user_id = ?",
                timeout: 30000,
                values: [req.session.user.user_id]
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
                    res.redirect('/profil')
                }
            });
        });
    }
    else
    {
        res.redirect('/')
    }
});

router.get('*', function (req, res, next)
{
    var userData;
    var steamData;
    if (typeof req.session.user !== 'undefined')
        userData = req.session.user;
    else
        userData = null;

    async.series([
            function (callback)
            {
                if (userData == null)
                {
                    var resErr = new Error();
                    resErr.status = 403;
                    next(resErr);
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
                        sql: "SELECT * FROM user_steam WHERE user_id = ? AND active = 1",
                        timeout: 30000,
                        values: [req.session.user.user_id]
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
                            steamData = results;
                            callback();
                        }
                    });
                });
            }
        ],
        function (error)
        {
            if (error)
            {
                // Hanteras separat.
            }
            else
            {
                res.render('profile', {
                    steam: steamData
                });
            }
        }
    )
});

function decodeBase64Image(dataString, callback)
{
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
        response = {};

    if (matches.length !== 3)
    {
        return callback(false);
    }

    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');

    return callback(response);
}

module.exports = router;