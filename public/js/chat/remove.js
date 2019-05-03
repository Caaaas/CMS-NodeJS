$(document).ready(function ()
{
    socket.on('removed message', function (data)
    {
        $('#chat-message-' + data).remove();
    });

    $(document).on('click', '.chat-delete', function ()
    {
        socket.emit('delete message', $(this).parent().parent().parent().attr("id"));
    });
});