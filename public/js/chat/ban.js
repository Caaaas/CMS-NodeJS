$(document).ready(function ()
{
    $(document).on('click', '.chat-ban', function ()
    {
        $(this).parent().parent().siblings(".ban-user-wrapper").slideToggle();
    });

    $(document).on('click', '.chat-ban-abort', function ()
    {
        $(this).parent().slideToggle();
    });

    $(document).on('click', '.chat-ban-confirm', function ()
    {
        latestClickDiv = $(this).parent();
        var banData = {};
        banData.time = $(this).parent().children(".chat-ban-time").val();
        banData.user_id = $(this).parent().siblings(".chat-user-wrapper").attr("id");
        socket.emit('chat user ban', banData);
    });

    socket.on('chat user banned', function (data)
    {
        if (data === "success")
        {
            $(latestClickDiv).slideToggle()
            $(latestClickDiv).siblings(".chat-user-wrapper").children(".chat-action-selector").removeClass("rotate");
            $(latestClickDiv).siblings(".chat-user-wrapper").children(".chat-actions").removeClass("display-chat-actions");
            $(latestClickDiv).children("h2").text('')
        }
        else
        {
            $(latestClickDiv).children("h2").text(data)
        }
    });

    socket.on('chat user banned global', function (data)
    {
        var userBannedString = "chat-user-" + data;
        $(".chat-user-wrapper").each(function ()
        {
            if ($(this).attr("id") === userBannedString)
            {
                $(this).children(".chat-user").addClass("chat-banned-user");
            }
        });
    });
});