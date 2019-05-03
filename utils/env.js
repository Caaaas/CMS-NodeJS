function sendEnviromentals(req, res, next) {
    var envVariables = {
	    mailSupport: process.env.MAIL_SUPPORT,
	    mailNoreply: process.env.MAIL_NO_REPLY,
	    websiteName: process.env.WEBSITE_NAME,
	    websiteDomainEnd: process.env.WEBSITE_DOMAIN_END,
	    serverFullDomain: process.env.SERVER_FULL_DOMAIN,
	    websiteTitle: process.env.WEBSITE_TITlE
    };

    req.envVariables = envVariables;
    res.locals.envVariables = envVariables;

    next();
}

module.exports = {
    sendEnviromentals: sendEnviromentals
};