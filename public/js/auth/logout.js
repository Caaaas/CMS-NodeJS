$(document).ready(function ()
{
    $("#sidemenu").on('click', '#logout', function ()
    {
        $.ajax({
            url: '/logout',
            type: 'GET',
            contentType: 'application/json',
            error: function (data)
            {
            },

            success: function (data)
            {
                window.location.reload();
            }

        });
    });
});