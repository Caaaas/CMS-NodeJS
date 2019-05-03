var express = require('express');
var router = express.Router();
var db = require.main.require('./utils/databases');
var bcrypt = require('bcryptjs');
var async = require("async");
var nodemailer = require('nodemailer');
var logger = require.main.require('./utils/logger');
var dateTime = require('node-datetime');
var fs = require('fs');
var randomstring = require("randomstring");

var smtpConfig = {
	host: process.env.MAIL_HOST,
	port: process.env.MAIL_PORT,
	secure: process.env.MAIL_SECURE,
	auth: {
		user: process.env.MAIL_USER,
		pass: process.env.MAIL_PASS
	},
	tls: {
		rejectUnauthorized: process.env.MAIL_REJECT_UNAUTH
	},
	requireTLS: process.env.MAIL_REQUIRE_TLS,
	debug: process.env.DEBUG
};

var transporter = nodemailer.createTransport(smtpConfig);


router.post('/', function (req, res, next)
{
	if (typeof req.session.user !== 'undefined')
	{
		res.sendStatus(401);
	}
	var email = req.body.email.trim();
	var username = req.body.username.trim();
	var password = req.body.password.trim();
	var terms = req.body.terms;
	var salt = bcrypt.genSaltSync(10);

	var newUserID;

	var errorObj = {};

	// Nu ska vi kolla en jävla massa saker.
	if (username)
	{
		if (username.length < 3)
			errorObj.username = "Ditt användarnamn måste vara minst 3 bokstäver långt.";
		if (!username.match(/^[a-zA-Z0-9ÅÄÖåäö\-*><#&_?!^]+( [a-zA-Z0-9ÅÄÖåäö\-*><#&_?!^]+)*$/))
			errorObj.username = "Ditt användarnamn får endast innehålla bokstäver och siffror.";
		if (username.length > 15)
			errorObj.username = "Ditt användarnamn får max vara 15 bokstäver långt.";
	}
	else
		errorObj.username = "Du måste ange ett användarnamn.";


	if (!email)
		errorObj.email = "Du måste ange en mejl.";
	else if (!email.match(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/))
		errorObj.email = "Vänligen ange en giltig mejl.";

	if (!password)
		errorObj.password = "Du måste ange ett lösenord.";
	else if (password.length < 6)
		errorObj.password = "Ditt lösenord måste vara minst 6 bokstäver långt.";

	if (terms !== true)
		errorObj.terms = "Du måste godkänna våra regler.";
	if (isEmptyObject(errorObj))
	{
		db.getForumConnection(function (err, connection)
		{
			connection.query({
				sql: "SELECT username, email FROM users WHERE username = ? OR email = ?",
				timeout: 30000,
				values: [username, email]
			}, function (error, results)
			{
				connection.release();
				if (error)
				{
					logger.info(error);
					res.sendStatus(503);
				}
				else
				{
					if (results.length > 0)
					{
						async.each(results, function (data, callback)
						{
							if (data.email.toLowerCase() == email.toLowerCase())
							{
								errorObj.email = "Mejl adressen är upptagen.";
							}
							if (data.username.toLowerCase() == username.toLowerCase())
							{
								errorObj.username = "Användarnamnet är upptaget.";
							}
							callback();
						}, function (error)
						{
							if (error)
							{
								logger.info(error);
								return callback(true);
							}
							else
							{
								res.send(errorObj);
							}
						});
					}
					else
					{
						db.getForumConnection(function (err, connection)
						{
							var datetime = dateTime.create();
							var formatted = datetime.format('Y-m-d H:M:S');
							var encryptedPassword = bcrypt.hashSync(password, salt);
							connection.query({
								sql: "INSERT INTO users SET username = ?, email = ?, password = ?, user_register_date = ?",
								timeout: 30000,
								values: [username, email.toLowerCase(), encryptedPassword, formatted]
							}, function (error, results)
							{
								connection.release();
								if (error)
								{
									logger.info(error);
									res.sendStatus(503);
								}
								else
								{
									newUserID = results.insertId;
									db.getForumConnection(function (err, connection)
									{
										connection.query({
											sql: "INSERT INTO users_active_groups SET uag_user_id = ?, uag_group_id = ?, uag_primary_group = ?",
											timeout: 30000,
											values: [newUserID, global.settings.user_default_group, 1]
										}, function (error, results)
										{
											connection.release();
											if (error)
											{
												logger.info(error);
												res.sendStatus(503);
											}
											else
											{
												var code = randomstring.generate({
													length: 32,
													charset: 'alphanumeric',
													capitalization: 'uppercase'
												});

												db.getForumConnection(function (err, connection)
												{
													connection.query({
														sql: "INSERT INTO unique_codes SET user_id = ?, code = ?, type = ?",
														timeout: 30000,
														values: [newUserID, code, "register"]
													}, function (error, results)
													{
														connection.release();
														if (error)
														{
															logger.info(error);
															res.sendStatus(503);
														}
														else
														{
															var emailData;
															var emailReplaced;

															fs.readFile(process.cwd() + '/views/emails/register.ejs', 'utf-8', function (error, data)
															{
																if (error)
																{
																	logger.info(error);
																	res.sendStatus(503);
																}
																else
																{
																	// $name
																	// $link_button
																	// $link_normal_if
																	// $link_if_not_work
																	// $link_if_not_work_text

																	var activateLink = "https://" + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + "/aktivera-konto/" + email + "/" + code;
																	emailData = data;
																	emailReplaced = emailData.replace("$name", username)
																		.replace("$link_button", activateLink)
																		.replace("$link_normal_if", activateLink)
																		.replace("$link_if_not_work", activateLink)
																		.replace("$link_if_not_work_text", activateLink)
																		.replace('$websiteName', process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END)
																		.replace('$websiteName', process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END);

																	var mailOptions = {
																		from: process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + ' <' + process.env.MAIL_NO_REPLY + '>',
																		to: email,
																		subject: "VÄLKOMMEN TILL " + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + " - Vänligen verifiera din mejl",
																		text: 'Hej ' + username + '\n\nVälkommen som medlem till ' + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END + '! Innan du kan börja använda ditt konto måste du verifiera din mejladress, detta gör du genom att kopiera länken nedan och sedan klistra in den i valfri webbläsare. \n\n' + activateLink + '\n\nMed vänliga hälsningar,\n' + process.env.WEBSITE_NAME + process.env.WEBSITE_DOMAIN_END,
																		html: emailReplaced
																	};

																	transporter.sendMail(mailOptions, function (error, info)
																	{
																		if (error)
																		{
																			logger.info(error);
																			res.sendStatus(503);
																		}
																		else
																		{
																			res.sendStatus(200);
																		}
																	});
																}
															});
														}
													});
												});
											}
										});
									});
								}
							});
						});
					}
				}
			});
		});
	}
	else
	{
		// Errors, avbryt, skicka tillbaka errorsen. Loggas separat.
		res.send(errorObj);
	}
});

function isEmptyObject(obj)
{
	for (var key in obj)
	{
		if (Object.prototype.hasOwnProperty.call(obj, key))
		{
			return false;
		}
	}
	return true;
}

module.exports = router;
