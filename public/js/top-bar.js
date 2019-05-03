$(document).ready(function ()
{
    $("#top_bar").on("click", ".fa-user", function ()
    {
        $("#sidebar").addClass("show");
        $("body").addClass("disable-overflow");
        $("#disable-background").addClass('show-overlay');
    });

    $("#top_bar").on("click", ".fa-bars", function ()
    {
        $("#sidemenu").addClass("show");
        $("body").addClass("disable-overflow");
        $("#disable-background").addClass('show-overlay');
    });
});