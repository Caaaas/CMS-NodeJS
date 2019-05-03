var uploadCrop = $('#profile-picture-container').croppie({
    viewport: {
        width: 200,
        height: 200,
        type: 'circle'
    },
    boundary: {
        width: 220,
        height: 220
    }
});

$(".uploader").on('dragover dragenter', function ()
{
    if (!$(".uploader").hasClass("activeHover"))
        $(".uploader").addClass("activeHover")
});

$(".uploader").on('dragleave dragend drop', function ()
{
    if ($(".uploader").hasClass("activeHover"))
        $(".uploader").removeClass("activeHover")
});

$("#crop-wrapper").on("click", "#picture-upload-abort", function ()
{
    $("#crop-wrapper").css("display", "none");
    $(".uploader").css("display", "block");
});

$("#crop-wrapper").on("click", "#picture-upload", function ()
{
    uploadCrop.croppie('result', {
        type: "base64",
        size: "viewport",
        format: "png",
        quality: 1,
        circle: false
    }).then(function (data)
    {
        $('#upload-picture-success-message').text();
        $('#upload-picture-error-message').text();
        $.ajax({
            url: "/profil/ladda-up-bild",
            type: "POST",
            data: {
                "image": data
            },
            error: function (data)
            {
                $("#crop-wrapper").css("display", "none");
                $(".uploader").css("display", "block");
                $('#upload-picture-error-message').text("Ett internt fel skedde, vänligen försök igen om ett litet tag.");
            },
            success: function (data)
            {
                $("#crop-wrapper").css("display", "none");
                $(".uploader").css("display", "block");
                $('#upload-picture-success-message').text("Lyckades! Din nya profilbild är nu uppladdad.");
            }
        });
    })
});

function previewFile()
{
    var file = document.querySelector('#profile-picture-upload').files[0];
    var reader = new FileReader();

    reader.addEventListener("load", function ()
    {
        if (file.type.match('image.*'))
        {
            $("#crop-wrapper").css("display", "block");
            $(".uploader").css("display", "none");
            uploadCrop.croppie('bind', {
                url: reader.result
            });
        }
    }, false);

    if (file)
    {
        reader.readAsDataURL(file);
    }
}