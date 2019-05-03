$(document).ready(function ()
{
    $("body").on("click", "#login-modal-open", function ()
    {
        $("body").addClass("disable-overflow");
        $("#disable-background").addClass('show-overlay');
        if ($("#sidemenu.show").length > 0 || $('.media-query-size.mediaL').css("color") !== "rgb(255, 0, 0)" || $('.media-query-size.mediaF').css("color") !== "rgb(255, 0, 0)")
        {
            $("#disable-background-menu").addClass('show-overlay');
        }
        $("#login-container").addClass('show-modal');
    });

    $("body").on("click", "#register-modal-open", function ()
    {
        $("body").addClass("disable-overflow");
        $("#disable-background").addClass('show-overlay');
        if ($("#sidemenu.show").length > 0 || $('.media-query-size.mediaL').css("color") !== "rgb(255, 0, 0)" || $('.media-query-size.mediaF').css("color") !== "rgb(255, 0, 0)")
        {
            $("#disable-background-menu").addClass('show-overlay');
        }
        $("#register-container").addClass('show-modal');
    });

    $("#login-container").on("click", "h3", function ()
    {
        hideLogin();
        $("#register-container").addClass('show-modal');
    });

    $("#login-container").on("click", "h4", function ()
    {
        hideLogin();
        $("#forgot-password-container").addClass('show-modal');
    });

    $("#register-container").on("click", "h3", function ()
    {
        hideRegister();
        $("#login-container").addClass('show-modal');
    });

    $("#register-success-container").on("click", "h4", function ()
    {
        hideRegisterSuccess();
        $("#login-container").addClass('show-modal');
    });

    $("#forgot-password-success-container").on("click", "h5", function ()
    {
        hideForgotPasswordSuccess();
        $("#login-container").addClass('show-modal');
    });

    $("#forgot-password-container").on("click", "h4", function ()
    {
        hideForgotPassword();
        $("#login-container").addClass('show-modal');
    });
});

function hideLogin()
{
    $("#login-container").addClass('slide-left-hide');
    $("#login-container").removeClass('show-modal');

    $("#login-container").one("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
        function (e)
        {
            $("#login-container").removeClass('slide-left-hide');
            $(this).off(e);
        });
}

function hideRegister()
{
    $("#register-container").addClass('slide-left-hide');
    $("#register-container").removeClass('show-modal');

    $("#register-container").one("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
        function (e)
        {
            $("#register-container").removeClass('slide-left-hide');
            $(this).off(e);
        });
}

function hideRegisterSuccess()
{
    $("#register-success-container").addClass('slide-left-hide');
    $("#register-success-container").removeClass('show-modal');

    $("#register-success-container").one("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
        function (e)
        {
            $("#register-success-container").removeClass('slide-left-hide');
            $(this).off(e);
        });
}

function hideForgotPassword()
{
    $("#forgot-password-container").addClass('slide-left-hide');
    $("#forgot-password-container").removeClass('show-modal');

    $("#forgot-password-container").one("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
        function (e)
        {
            $("#forgot-password-container").removeClass('slide-left-hide');
            $(this).off(e);
        });
}

function hideForgotPasswordSuccess()
{
    $("#forgot-password-success-container").addClass('slide-left-hide');
    $("#forgot-password-success-container").removeClass('show-modal');

    $("#forgot-password-success-container").one("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
        function (e)
        {
            $("#forgot-password-success-container").removeClass('slide-left-hide');
            $(this).off(e);
        });
}


function hideAll()
{
    hideLogin();
    hideRegister();
    hideRegisterSuccess();
    hideForgotPassword();
    hideForgotPasswordSuccess();
}