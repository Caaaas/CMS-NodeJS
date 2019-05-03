var stickyUser = null;
$(document).ready(function ()
{
    $(".ql-toolbar").stick_in_parent();

    if ($('.media-query-size.mediaS').css("color") !== "rgb(255, 0, 0)" && $('.media-query-size.mediaXS').css("color") !== "rgb(255, 0, 0)" && $('.media-query-size.mediaC').css("color") !== "rgb(255, 0, 0)")
    {
        stickyUser = $(".post-user").stick_in_parent();
    }

    var globalTimer = null;
    $(window).resize(function ()
    {
        clearTimeout(globalTimer);
        globalTimer = setTimeout(doneResize, 500);
    });

    function doneResize()
    {
        $(".post-user").trigger("sticky_kit:detach");
        stickyUser = null;
        if ($('.media-query-size.mediaS').css("color") !== "rgb(255, 0, 0)" && $('.media-query-size.mediaXS').css("color") !== "rgb(255, 0, 0)" && $('.media-query-size.mediaC').css("color") !== "rgb(255, 0, 0)")
        {
            stickyUser = $(".post-user").stick_in_parent();
        }
    }

    $(stickyUser)
        .on("sticky_kit:bottom", function (e)
        {
            $(e.target).addClass("bottomed");
        })
        .on("sticky_kit:unbottom", function (e)
        {
            $(e.target).removeClass("bottomed");
        });
});