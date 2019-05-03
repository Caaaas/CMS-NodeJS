$(document).ready(function ()
{
    $("body").on("click", ".show-overlay", function ()
    {
        if ($('#sidebar.show').length > 0)
        {
            $("#disable-background").removeClass('show-overlay');
            $("body").removeClass("disable-overflow");
            $("#sidebar").removeClass("show");
        }
        else if ($('.show-modal').length > 0 && $('#sidemenu.show').length > 0)
        {
            hideAll();
            $("body").removeClass("disable-overflow");
            $("#disable-background-menu").removeClass('show-overlay');
        }
        else if ($('.show-modal').length > 0 && $('#sidemenu.show').length == 0)
        {
            hideAll();
            $("body").removeClass("disable-overflow");
            $("#disable-background").removeClass('show-overlay');
        }
        else
        {
            $("body").removeClass("disable-overflow");
            $("#disable-background").removeClass('show-overlay');
            $("#sidemenu").removeClass("show");
        }

        if ($('.media-query-size.mediaL').css("color") !== "rgb(255, 0, 0)" || $('.media-query-size.mediaF').css("color") !== "rgb(255, 0, 0)")
        {
            $("#disable-background-menu").removeClass('show-overlay');
        }
    });
});