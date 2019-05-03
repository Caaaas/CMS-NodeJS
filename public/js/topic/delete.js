$(document).ready(function ()
{
    $(".post-actions-inner").on("click", ".fa-trash-o", function ()
    {
        var postToRemove = $(this).parent().parent().parent().attr("id");
        $.ajax({
            url: '/radera-inlagg',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                post_id: postToRemove
            }),
            error: function (data)
            {
            },

            success: function (data)
            {
                if (data.code === "OK" || data.code === 200)
                {
                    $("#" + postToRemove).parent().remove();
                    window.location.replace(data.url);
                }
                else
                {
                    window.location.replace("/403");
                }
            }
        });
    });
});