$(document).ready(function ()
{
    var path = window.location.pathname;
    var pathParts = path.split("/");

    $("#forgot-password-container").on("click", "#forgot-password-submit", function ()
    {
        submitForgotPasswordFunction();
    });

    function submitForgotPasswordFunction()
    {
        $.ajax({
            url: '/glomt-losenord/skicka',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                username: $('#forgot-password-container #forgot-password-username').val(),
                email: $('#forgot-password-container #forgot-password-email').val()
            }),
            error: function (data)
            {
                $("#forgot-password-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
            },

            success: function (data)
            {
                $("#forgot-password-error").text("");
                if (data.status === "OK")
                {
                    hideForgotPassword();
                    $("#forgot-password-success-container").addClass('show-modal');
                    $("#forgot-password-success-container h2").html(data.message);
                }
                else if (data.error)
                {
                    $("#forgot-password-error").text(data.error);
                }
                else
                {
                    $("#register-username-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
                }
            }
        });
    }

    $(".forgot-password-wrapper").on("click", "#forgot-password-update-submit", function ()
    {
        submitForgotPasswordUpdateFunction();
    });

    function submitForgotPasswordUpdateFunction()
    {
        $.ajax({
            url: '/glomt-losenord/uppdatera',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password: $('.forgot-password-wrapper #forgot-password-new').val(),
                email: pathParts[2],
                code: pathParts[3]
            }),
            error: function (data)
            {
                $("#forgot-password-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
            },

            success: function (data)
            {
                $("#forgot-password-update-error").text("");
                if (data === "OK")
                {
                    $(".forgot-password-update-pre-wrapper").css("display", "none");
                    $(".forgot-password-update-after-wrapper").css("display", "block");
                }
                else if (data.error)
                {
                    $("#forgot-password-update-error").text(data.error);
                }
                else
                {
                    $("#forgot-password-update-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
                }
            }
        });
    }
});