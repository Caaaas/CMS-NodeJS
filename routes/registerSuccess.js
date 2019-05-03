var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next)
{
    res.render('registerSuccess', {
        session: req.session,
        chat: req.chat
    });
});

module.exports = router;
