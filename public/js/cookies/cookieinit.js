window.addEventListener("load", function ()
{
    window.cookieconsent.initialise({
        "palette": {
            "popup": {
                "background": "#34495e",
                "text": "#ffffff"
            },
            "button": {
                "background": "#e74c3c",
                "text": "#ffffff"
            }
        },
        "theme": "edgeless",
        "content": {
            "message": "Den här hemsidan använder cookies för att du ska få den bästa möjliga upplevelsen på vår hemsida.",
            "dismiss": "Jag förstår",
            "link": "Läs mer",
            "href": "/kakor"
        }
    })
});