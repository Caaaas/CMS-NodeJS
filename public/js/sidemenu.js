$(document).ready(function ()
{
    $("body").on("click", "#sidemenu li", function ()
    {
        $(this).find("ul").slideToggle(500);
        if ($(this).find('i').hasClass("fa-chevron-up"))
        {
            $(this).find('i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        }
        else
        {
            $(this).find('i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
        }
    });
});