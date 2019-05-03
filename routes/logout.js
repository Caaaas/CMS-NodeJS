var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    req.session.destroy();
    res.send("success");
});

module.exports = router;
