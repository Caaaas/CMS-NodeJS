var express = require('express');
var router = express.Router();

router.get('/forum', function (req, res, next)
{
    res.render('rules', {
        group: "forum"
    });
});

router.get('/servrar', function (req, res, next)
{
    res.render('rules', {
        group: "servrar"
    });
});

router.get('/teamspeak', function (req, res, next)
{
    res.render('rules', {
        group: "teamspeak"
    });
});

module.exports = router;