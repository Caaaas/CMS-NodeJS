$(document).ready(function ()
{
    $("#chat").on('click', '#chat_new_message_submit', function ()
    {
        socket.emit('send message', $('#chat_new_message').val());
        $('#chat_new_message').height('24px');
    });

    $('#chat_new_message').keydown(function(event)
    {
        if (event.keyCode === 13)
        {
            socket.emit('send message', $('#chat_new_message').val());
            $('#chat_new_message').height('24px');
            return false;
        }
    });

    socket.on('chat submit info', function (data)
    {
        if (data === "success")
        {
            $("#chat_submit_error").text('');
            $('#chat_new_message').val('');
        }
        else
        {
            $("#chat_submit_error").text(data);
        }
    });

    socket.on('new message', function (data)
    {
        // Klienten och servern har inte alltid samma tid, så vi justerar för detta :)
        var dateTime = moment();
        dateTime.add(-2, "seconds");
        $("#chat-inner").append('\
            <div class="chat-message" id="chat-message-' + data.chatID + '">\
                <div class="chat-user-wrapper" id="chat-user-' + data.user_id + '">\
                    <img src="/uploads/profile-pictures/' + data.user_id + '.png">\
                    <div class="chat-user">\
                        <a href="/anvandare/' + data.username + '-' + data.user_id + '" style="color: ' + data.color + '">' + data.username + '</a>\
                        <h2>' + moment(dateTime).fromNow() + '</h2>\
                    </div>\
                </div>\
            </div>');

        if (chatPermissions.chat_ban || chatPermissions.chat_edit_own || chatPermissions.chat_edit_all || chatPermissions.chat_hide_own || chatPermissions.chat_hide_all)
        {
            $(".chat-message").last().children(".chat-user-wrapper").append('<i class="fa fa-angle-double-left chat-action-selector" aria-hidden="true"></i><div class="chat-actions"></div>');
        }

        if (chatPermissions.chat_ban)
        {
            $(".chat-message").last().children(".chat-user-wrapper").children(".chat-actions").append('<i class="fa fa-ban chat-ban" aria-hidden="true"></i>');
        }
        if ((chatPermissions.chat_hide_own && chatPermissions.chat_user_id == data.user_id) || chatPermissions.chat_hide_all)
        {
            $(".chat-message").last().children(".chat-user-wrapper").children(".chat-actions").append('<i class="fa fa-trash-o chat-delete" aria-hidden="true"></i>');
        }
        if ((chatPermissions.chat_edit_own && chatPermissions.chat_user_id == data.user_id) || chatPermissions.chat_edit_all)
        {
            $(".chat-message").last().children(".chat-user-wrapper").children(".chat-actions").append('<i class="fa fa-pencil chat-edit" aria-hidden="true"></i>');
        }

        if (chatPermissions.chat_ban)
        {
            $(".chat-message").last().append('\
                <div class="ban-user-wrapper">\
                    <h2></h2>\
                    <p>Längd avstängning (min): </p>\
                    <input type="text" class="chat-ban-time">\
                    <div class="chat-ban-confirm"><i class="fa fa-check" aria-hidden="true"></i></div>\
                    <div class="chat-ban-abort"><i class="fa fa-times" aria-hidden="true"></i></div>\
                </div>');
        }

        if (chatPermissions.chat_edit_own || chatPermissions.chat_edit_all)
        {
            $(".chat-message").last().append('\
                <div class="edit-message-wrapper">\
                    <h2></h2>\
                    <textarea class="chat_edit_message" placeholder="Redigera ditt meddelande..." maxlength="140">' + data.message + '</textarea>\
                    <div class="chat-edit-confirm"><i class="fa fa-check" aria-hidden="true"></i></div>\
                    <div class="chat-edit-abort"><i class="fa fa-times" aria-hidden="true"></i></div>\
                </div>');
        }

        $(".chat-message").last().append('<div class="chat-message-message">' + data.message + '</div>');

        $('.chat_edit_message').each(function(){
            autosize(this);
        });

        var d = $('#chat-inner');
        d.scrollTop(d.prop("scrollHeight"));
    });
});