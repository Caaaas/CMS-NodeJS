var latestClickDiv;
$(document).ready(function ()
{
    $(document).on('click', '.chat-action-selector', function ()
    {
        $(this).toggleClass("rotate");
        $(this).next(".chat-actions").toggleClass("display-chat-actions");
    });

    autosize($("#chat_new_message"));

    var d = $('#chat-inner');
    d.scrollTop(d.prop("scrollHeight"));
});