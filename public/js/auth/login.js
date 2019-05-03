$(document).ready(function ()
{
    $('#login-container #login-username').keydown(function (e)
    {
        if (e.which == 13)
            $('#login-container #login-password').focus();
    });

    $('#login-container #login-password').keydown(function (e)
    {
        if (e.which == 13)
            submitLoginFunction();
    });

    $("#login-container").on("click", "#login-submit", function ()
    {
        submitLoginFunction();
    });

    function submitLoginFunction()
    {
        $.ajax({
            url: '/login',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                username: $('#login-container #login-username').val(),
                password: $('#login-container #login-password').val(),
                rememberme: $('#login-container #login-remember-me').prop('checked')
            }),
            error: function (data)
            {
                $("#login-username-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
            },

            success: function (data)
            {
                $("#login-username-error").text("");
                $("#login-password-error").text("");
                if (data === "OK")
                {
                    window.location.reload();
                }
                else if (data.username || data.password)
                {
                    if (data.username)
                    {
                        $("#login-username-error").text(data.username)
                    }
                    if (data.password)
                    {
                        $("#login-password-error").text(data.password)
                    }
                }
                else
                {
                    $("#login-username-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
                }
            }

        });
    }
});