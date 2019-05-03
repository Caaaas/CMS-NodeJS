var express = require('express');
var router = express.Router();
var util = require('util');
var mysql = require('mysql');

router.get('/*', function (req, res, next)
{
    res.render('cookies', {
        session: req.session,
        chat: req.chat
    });
});

module.exports = router;