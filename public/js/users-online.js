socket.on('userlist update', function (data)
{
    // Uppdaterar Staff list.
    $('#staff-online').html('');
    $('#staff-online').append('<h1><i class="fa fa-users" aria-hidden="true"></i> STAFF ONLINE</h1>');
    var i = 0;
    for (attr in data.staff)
    {
        i++;
        $('#staff-online').append('\
                <div class="user-online">\
                    <img src="/uploads/profile-pictures/' + attr + '.png">\
                    <div class="user-online-data">\
                        <a href="/anvandare/' + data.staff[attr].username + '-' + attr + '">' + data.staff[attr].username + '</a>\
                        <div class="group-wrapper"></div>\
                    </div>\
                </div>');

        for (group in data.staff[attr].groups)
        {
            $('#staff-online .user-online .user-online-data .group-wrapper').last().append('<h3 style="background-color: ' + data.staff[attr].groups[group].color + '">' + data.staff[attr].groups[group].name + '</h3>');
        }
    }
    if (i == 0)
    {
        $('#staff-online').append('<h3>Ingen staff online.</h3>');
    }

    // Uppdaterar Medlemmar list.
    $('#members-online').html('');
    $('#members-online').append('<h1><i class="fa fa-users" aria-hidden="true"></i> MEDLEMMAR ONLINE</h1>');
    var i = 0;
    for (attr in data.users)
    {
        i++;
        $('#members-online').append('\
                <div class="user-online">\
                    <img src="/uploads/profile-pictures/' + attr + '.png">\
                    <div class="user-online-data">\
                        <a href="/anvandare/' + data.users[attr].username + '-' + attr + '">' + data.users[attr].username + '</a>\
                        <div class="group-wrapper"></div>\
                    </div>\
                </div>');

        for (group in data.users[attr].groups)
        {
            $('#members-online .user-online .user-online-data .group-wrapper').last().append('<h3 style="background-color: ' + data.users[attr].groups[group].color + '">' + data.users[attr].groups[group].name + '</h3>');
        }
    }
    if (i == 0)
    {
        $('#members-online').append('<h3>Inga medlemmar online.</h3>');
    }

    // Uppdaterar gäst-listan.
    $('#guests-online').html('');
    if (data.guests == 0)
    {
        $('#guests-online').append('<h3>Inga gäster online.</h3>');
    }
    else if (data.guests == 1)
    {
        $('#guests-online').append('<h3>1 gäst online.</h3>');
    }
    else
    {
        $('#guests-online').append('<h3>' + data.guests + ' gäster online.</h3>');
    }
});

$("body").on("click", "#users-online .selectable-user .user-online", function ()
{
    $("#selected-user-online").empty();
    $(this).clone().appendTo("#selected-user-online");
});

$("body").on("click", "#users-online #selected-user-online img", function ()
{
    $("#selected-user-online").empty();
});