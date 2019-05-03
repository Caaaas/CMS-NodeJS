$(document).ready(function ()
{
    $(".post-actions-inner").each(function()
    {
        if ($(this).children().length > 0)
        {
            $(this).prev().css("display", "block");
        }
    });

    $(".post-reactions-inner").each(function()
    {
        if ($(this).children().length > 0)
        {
            $(this).prev().css("display", "block");
        }
    });

    $(window).resize(function() {
        $(".post-actions-inner").each(function() {
            if ($(this).children("i").first().css("display") == "block")
            {
                if ($(this).hasClass("display-action-bar"))
                {
                    $(this).css("display", "block");
                    $(this).removeClass("display-action-bar");
                    $(this).prev(".fa-angle-double-left").removeClass("display-action-bar");
                }
            }
            else
            {
                if ($(this).css("display") == "block")
                {
                    $(this).css("display", "none");
                    $(this).addClass("display-action-bar");
                    $(this).prev(".fa-angle-double-left").addClass("display-action-bar");
                }
            }
        });
    });

    $(".post-actions").on('click', '.fa-angle-double-left', function ()
    {
        if ($(this).next(".post-actions-inner").children().first().children().first().css("display") == "block" || $(this).next(".post-actions-inner").children().first().css("display") == "block")
        {
            $(this).next(".post-actions-inner").slideToggle(300);
        }
        else
        {
            $(this).toggleClass("display-action-bar");
            $(this).next(".post-actions-inner").toggleClass("display-action-bar");
            $(this).next(".post-actions-inner a i").toggleClass("display-action-bar");
        }

        $(this).toggleClass("rotate");
    });
    });