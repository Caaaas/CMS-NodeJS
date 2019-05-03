var moment = require('moment');
moment.locale('sv');

customURLEncode = function (URL)
{
    if (URL === null) {
        return "";
    }
    URL = URL.replace(/-/gi, '');
    URL = URL.replace(/,/gi, '');
    URL = URL.replace(/ /gi, '-');
    URL = URL.replace(/#/gi, '');
    URL = URL.replace(/&/gi, '-');
    URL = URL.replace(/å/gi, 'a');
    URL = URL.replace(/ä/gi, 'a');
    URL = URL.replace(/ö/gi, 'o');

    return URL.toLowerCase();
};

timeToPrint = function (datetime)
{
    var moreThan = moment(datetime).add(24, 'hours');
    if (moreThan > moment())
    {
        return moment(datetime).fromNow();
    }
    else
    {
        return moment(datetime).calendar();
    }
};

arrayContainsTag = function (array, object)
{
    for (var i = 0; i < array.length; i++)
    {
        if (array[i].tag_id === object.tag_id)
        {
            return true;
        }
    }
    return false;
};

printURL = function (title, id, object)
{
    return encodeURIComponent(customURLEncode(title)) + "-" + id;
};

module.exports = {
    customURLEncode: customURLEncode,
    timeToPrint: timeToPrint,
    arrayContainsTag: arrayContainsTag,
    printURL: printURL
}