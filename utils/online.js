var len = require('object-length');
var moment = require('moment');

exports = module.exports = function (io)
{
    var staffOnline = {};
    var usersOnline = {};
    var guestConnections = {};

    function updateSingle(socket)
    {
        var returnInfo = {};
        returnInfo.staff = staffOnline;
        returnInfo.users = usersOnline;
        returnInfo.guests = len(guestConnections);
        socket.emit('userlist update', returnInfo);
    }

    function updateAll()
    {
        var returnInfo = {};
        returnInfo.staff = staffOnline;
        returnInfo.users = usersOnline;
        returnInfo.guests = len(guestConnections);
        io.sockets.emit('userlist update', returnInfo);
    }

    io.sockets.on('connection', function (socket)
    {
        var time = moment()
        if (typeof socket.handshake.session.user !== 'undefined')
        {
            var inStaffArray = false;
            for (var i = 0; i < global.settings.groups_in_staff.length; i++)
            {
                for (var j = 0; j < socket.handshake.session.user.groups.length; j++)
                {
                    if (global.settings.groups_in_staff[i] == socket.handshake.session.user.groups[j].group_id)
                    {
                        inStaffArray = true;
                        i = global.settings.groups_in_staff.length;
                    }
                }
            }

            if (inStaffArray)
            {
                if (typeof staffOnline[socket.handshake.session.user.user_id] === "undefined")
                {
                    staffOnline[socket.handshake.session.user.user_id] = {};
                    staffOnline[socket.handshake.session.user.user_id].username = socket.handshake.session.user.username;
                    staffOnline[socket.handshake.session.user.user_id].groups = socket.handshake.session.user.groups;
                    staffOnline[socket.handshake.session.user.user_id].connections = 1;
                    staffOnline[socket.handshake.session.user.user_id].lastOnline = time;

                    updateAll();
                }
                else
                {
                    staffOnline[socket.handshake.session.user.user_id].connections += 1;
                    staffOnline[socket.handshake.session.user.user_id].lastOnline = time;
                }
            }
            else
            {
                if (typeof usersOnline[socket.handshake.session.user.user_id] === "undefined")
                {
                    usersOnline[socket.handshake.session.user.user_id] = {};
                    usersOnline[socket.handshake.session.user.user_id].username = socket.handshake.session.user.username;
                    usersOnline[socket.handshake.session.user.user_id].groups = socket.handshake.session.user.groups;
                    usersOnline[socket.handshake.session.user.user_id].connections = 1;
                    usersOnline[socket.handshake.session.user.user_id].lastOnline = time;

                    updateAll();
                }
                else
                {
                    usersOnline[socket.handshake.session.user.user_id].connections += 1;
                    usersOnline[socket.handshake.session.user.user_id].lastOnline = time;
                }
            }
        }
        else
        {
            var clientIp = socket.request.connection.remoteAddress;

            if (typeof guestConnections[clientIp] === "undefined")
            {
                guestConnections[clientIp] = {};
                guestConnections[clientIp].connections = 1;
                guestConnections[clientIp].lastOnline = time;

                updateAll();
            }
            else
            {
                guestConnections[clientIp].connections += 1;
                guestConnections[clientIp].lastOnline = time;
            }
        }

        // Disconnect
        socket.on('disconnect', function (data)
        {
            if (typeof socket.handshake.session.user !== 'undefined')
            {
                if (typeof staffOnline[socket.handshake.session.user.user_id] !== "undefined")
                {
                    staffOnline[socket.handshake.session.user.user_id].connections -= 1;
                    checkIfLeft(staffOnline, socket.handshake.session.user.user_id)
                }
                else if (typeof usersOnline[socket.handshake.session.user.user_id] !== "undefined")
                {
                    usersOnline[socket.handshake.session.user.user_id].connections -= 1;
                    checkIfLeft(usersOnline, socket.handshake.session.user.user_id)
                }
            }
            else
            {
                var clientIp = socket.request.connection.remoteAddress;
                if (typeof guestConnections[clientIp] !== "undefined")
                {
                    guestConnections[clientIp].connections -= 1;
                    checkIfLeft(guestConnections, clientIp)
                }
            }
        });

        // Uppdatera för connectade usern
        updateSingle(socket);

        function checkIfLeft(list, location)
        {
            setTimeout(function ()
            {
                // Om en user stänger 2 tabbar samtidigt, kommer fel skapas om inte denna koll finns.
                if (typeof list[location] !== "undefined")
                {
                    if (list[location].connections <= 0)
                    {
                        delete list[location];
                        updateAll();
                    }
                }
            }, 5000)
        }
    });

    // Uppdatera för alla users.
    setInterval(function ()
    {
        for (attr in staffOnline)
        {
            var date = staffOnline[attr].lastOnline;
            var newDate = moment();
            var diff = newDate.diff(date, 'minutes');

            if (diff >= 10)
            {
                delete staffOnline[attr];
            }
        }

        for (attr in usersOnline)
        {
            var date = usersOnline[attr].lastOnline;
            var newDate = moment();
            var diff = newDate.diff(date, 'minutes');

            if (diff >= 10)
            {
                delete usersOnline[attr];
            }
        }

        for (attr in guestConnections)
        {
            var date = guestConnections[attr].lastOnline;
            var newDate = moment();
            var diff = newDate.diff(date, 'minutes');

            if (diff >= 10)
            {
                delete guestConnections[attr];
            }
        }
        updateAll();
    }, 60000);
};