$(document).ready(function ()
{
    $(function() {
        $(".post-reactions").on('click', '.fa-smile-o', function ()
        {
            $(this).next(".post-reactions-inner").children(".post-reaction").toggleClass("display-reaction");
            $(this).prev(".post-datetime").toggleClass("reactions-displaying");
        });
    });
    
    $(".post-reaction").on('click', '.fa', function ()
    {
        var clicked = $(this);
        $.ajax({
            url: '/reactions',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                postId: $(this).parent().parent().parent().parent().attr("id"),
                reactionType: $(this).attr("reaction-type")
            }),
            error: function (data)
            {
            },

            success: function (data)
            {
                if (data == "increase")
                {
                    $(clicked).parent().addClass("has-reacted");
                    $(clicked).parent().addClass("has-reactions");

                    var $currentValue = $(clicked).prev();

                    $currentValue.html((parseInt($currentValue.html(), 10) || 0) + 1);
                }
                else if (data == "decrease")
                {
                    $(clicked).parent().removeClass("has-reacted");

                    var $currentValue = $(clicked).prev();

                    $currentValue.html((parseInt($currentValue.html(), 10) || 0) - 1);

                    if ($(clicked).prev().html() == 0)
                    {
                        $(clicked).parent().removeClass("has-reactions");
                    }
                }
                else if (data == "OK")
                {
                    // :/
                }
            }
        });
    });
});