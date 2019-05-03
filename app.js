var dotenv = require('dotenv');
var dotenvParseVariables = require('dotenv-parse-variables');
var env = dotenv.config({});
if (env.error)
    throw env.error;
process.env = dotenvParseVariables(env.parsed);

var path = require('path');
var logger = require.main.require('./utils/logger');
var express = require('express');
var expressLayouts = require('express-ejs-layouts');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require("fs");

// Det som tar hand om live-chatten.
require('./routes/modules/chat/sendMessage.js')(io);
require('./routes/modules/chat/deleteMessage.js')(io);
require('./routes/modules/chat/editMessage.js')(io);
require('./routes/modules/chat/banUser.js')(io);

var favicon = require('serve-favicon');
var bodyParser = require('body-parser');

var db = require('./utils/databases');

// Almänna funktioner som kan användas eventuellt vid render
var perms = require.main.require('./utils/getPermissions');
var functionsGeneral = require.main.require('./utils/functions/general');
var functionsTopic = require.main.require('./utils/functions/topic');
var functionsChat = require.main.require('./utils/functions/chat');
var functionsForum = require.main.require('./utils/functions/forum');
var functionsSession = require.main.require('./utils/session');
var functionsIP = require.main.require('./utils/ip');
var functionsSettings = require.main.require('./utils/settings');
var functionsEnv = require.main.require('./utils/env');
require.main.require('./utils/online')(io);
var moment = require('moment');
moment.locale('sv');
app.locals.functions = {};
app.locals.functions.general = functionsGeneral;
app.locals.functions.topic = functionsTopic;
app.locals.functions.chat = functionsChat;
app.locals.functions.forum = functionsForum;
app.locals.moment = moment;
app.locals.path = __dirname + "/views";
functionsSettings.getSettingsStart();

var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);

var sessionStore = new MySQLStore({
    createDatabaseTable: true
}, db.poolForum);

var sessionOptions = {
    key: null,
    secret: 'ads908ahyhf9sdgf09asdfhoasdbfa98åäö123s7dfasdfasdf',
    store: sessionStore,
    resave: true,
    saveUninitialized: true
};
app.use(session(sessionOptions));
var sharedSession = require('express-socket.io-session');

['log', 'warn'].forEach(function (method)
{
    var old = console[method];
    console[method] = function ()
    {
        var stack = (new Error()).stack.split(/\n/);
        // Chrome includes a single "Error" line, FF doesn't.
        if (stack[0].indexOf('Error') === 0)
        {
            stack = stack.slice(1);
        }
        var args = [].slice.apply(arguments).concat([stack[1].trim()]);
        return old.apply(console, args);
    };
});

// Interna namn
var index = require('./routes/index');
var users = require('./routes/users');
var register = require('./routes/register');
var registerSuccess = require('./routes/registerSuccess');
var login = require('./routes/login');
var logout = require('./routes/logout');
var forum = require('./routes/forum');
var topic = require('./routes/topic');
var servers = require('./routes/servers');
var topic_new = require('./routes/topic_new');
var post = require('./routes/post');
var archive = require('./routes/archive');
var reactions = require('./routes/reactions');
var forgot_password = require('./routes/forgot_password');
var topic_edit = require('./routes/topic_edit');
var topic_sticky = require('./routes/topic_sticky');
var users_agreement = require('./routes/users_agreement');
var activate_account = require('./routes/activate_account');
var post_new = require('./routes/post_new');
var profile = require('./routes/profile');
var rules = require('./routes/rules');
var topic_delete = require('./routes/topic_delete');
var cookies = require('./routes/cookies');
var topic_lock = require('./routes/topic_lock.js');
var stafflist = require('./routes/stafflist.js');


// view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout/layout');

app.use(favicon(path.join(__dirname, 'public', '/favicons/favicon.ico')));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));


app.use(express.static(path.join(__dirname, 'public')))

// Om vi inte hittar static profilbilden, så har usern ingen, vi skickar då standardbilden.
app.use('/uploads/profile-pictures/*', function (req, res, next)
{
    if (!fs.existsSync(req.originalUrl))
    {
        res.sendFile('public/uploads/profile-pictures/unknown.png', {root: __dirname});
    }
});

// Middlewares
app.use(functionsSettings.getSettings);
app.use(functionsSession.connectSession);
app.use(perms.getPermissions);
app.use(functionsIP.getIP);
app.use(functionsChat.sendChat);
app.use(functionsEnv.sendEnviromentals);

// URL'n som användaren använder
app.use('/index', index);
app.use('/', index);
app.use('/anvandare', users);
app.use('/register', register);
app.use('/login', login);
app.use('/logout', logout);
app.use('/register/success', registerSuccess);
app.use('/forum', forum);
app.use('/trad', topic);
app.use('/servrar', servers);
app.use('/ny-trad', topic_new);
app.use('/inlagg', post);
app.use('/arkiv', archive);
app.use('/reactions', reactions);
app.use('/glomt-losenord', forgot_password);
app.use('/redigera-inlagg', topic_edit);
app.use('/sticky-trad', topic_sticky);
app.use('/anvandaravtal', users_agreement);
app.use('/aktivera-konto', activate_account);
app.use('/nytt-inlagg', post_new);
app.use('/profil', profile);
app.use('/regler', rules);
app.use('/radera-inlagg', topic_delete);
app.use('/kakor', cookies);
app.use('/las-trad', topic_lock);
app.use('/staff', stafflist);


server.listen(process.env.PORT || 8080);

console.log("Server startad på port " + server.address().port);

io.use(sharedSession(session(sessionOptions), {
    autoSave: true
}));

app.use(function (req, res, next)
{
    var error = new Error();
    error.message = "Sidan hittades inte.";
    error.status = 404;
    next(error, req, res);
});

app.use(function (err, req, res, next)
{
    // Gömmer meddelandet om vi inte är i DEV.
/*    if (process.env.DEBUG !== true)
        err.message = "";*/
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        status: err.status
    });
});


module.exports = app;