$(document).ready(function ()
{
    $("#wrapper-main").on('click', '#password-change-submit', function ()
    {
        $('#change-password-error').text("");
        $('#change-password-success').text("");
        $.ajax({
            url: '/profil/byt-losenord',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password_old: $('#change-password-old').val(),
                password_new: $('#change-password-new').val()
            }),

            error: function (data)
            {
                $('#change-password-error').text("Det skedde ett internt fel, vänligen försök igen om ett litet tag.");
            },

            success: function (data)
            {
                if (data == "OK")
                {
                    $('#change-password-success').text("Ditt lösenord har ändrats.");
                    $('#change-password-old').val("")
                    $('#change-password-new').val("")
                }
                else if (data.code = "custom")
                {
                    $('#change-password-error').text(data.message);
                }
                else
                {
                    $('#change-password-error').text("Det skedde ett internt fel, vänligen försök igen om ett litet tag.");
                }
            }
        });
    });
});