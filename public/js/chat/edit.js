$(document).ready(function ()
{
    socket.on('edited message', function (data)
    {
        $("#chat-message-" + data.id).children(".edit-message-wrapper").children("textarea").val(data.new_message);
        $("#chat-message-" + data.id).children(".chat-message-message").text(data.new_message);
    });

    socket.on('chat edit message info', function (data)
    {
        if (data === "success")
        {
            $(latestClickDiv).slideToggle();
            $(latestClickDiv).siblings(".chat-user-wrapper").children(".chat-action-selector").removeClass("rotate");
            $(latestClickDiv).siblings(".chat-user-wrapper").children(".chat-actions").removeClass("display-chat-actions");
            $(latestClickDiv).children("h2").text('')
        }
        else
        {
            $(latestClickDiv).children("h2").text(data)
        }
    });

    $('.chat_edit_message').each(function(){
        autosize(this);
    });

    $(document).on('click', '.chat-edit', function ()
    {
        $(this).parent().parent().siblings(".edit-message-wrapper").slideToggle(function()
        {
            autosize.update(($(this).children("textarea")));
        });
    });

    $(document).on('click', '.chat-edit-abort', function ()
    {
        $(this).parent().slideToggle();
    });

    $(document).on('click', '.chat-edit-confirm', function ()
    {
        latestClickDiv = $(this).parent();
        var editData = {};
        editData.message_id = $(this).parent().parent().attr("id");
        editData.message_new = $(this).siblings("textarea").val();
        socket.emit('chat edit message', editData);
    });
});