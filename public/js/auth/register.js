$(document).ready(function ()
{
    $('#register-container #register-email').keydown(function (e)
    {
        if (e.which == 13)
            $('#register-container #register-username').focus();
    });

    $('#register-container #register-username').keydown(function (e)
    {
        if (e.which == 13)
            $('#register-container #register-password').focus();
    });

    $("#register-container").on("click", "#register-submit", function ()
    {
        submitRegisterFunction();
    });

    function submitRegisterFunction()
    {
        $.ajax({
            url: '/register',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                email: $('#register-container #register-email').val(),
                username: $('#register-container #register-username').val(),
                password: $('#register-container #register-password').val(),
                terms: $('#register-container #register-terms').prop('checked')
            }),
            error: function (data)
            {
                $("#register-email-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
            },

            success: function (data)
            {
                $("#register-email-error").text("");
                $("#register-username-error").text("");
                $("#register-password-error").text("");
                $("#register-terms-error").text("");
                if (data === "OK")
                {
                    hideRegister();
                    $("#register-success-container").addClass('show-modal');
                }
                else if (data.username || data.password || data.email || data.terms)
                {
                    if (data.username)
                    {
                        $("#register-username-error").text(data.username)
                    }
                    if (data.password)
                    {
                        $("#register-password-error").text(data.password)
                    }
                    if (data.email)
                    {
                        $("#register-email-error").text(data.email)
                    }
                    if (data.terms)
                    {
                        $("#register-terms-error").text(data.terms)
                    }
                }
                else
                {
                    $("#register-username-error").text("Ett internt fel uppstod, vänlig försök igen om ett litet tag.");
                }
            }
        });
    }
});