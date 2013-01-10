var s = require("./string");
var graph = require("fbgraph");
var crypto = require("crypto");
var fb_config = {};
var fb_error = null;

var handle_error = function(msg, err, req, res, next) {
	console.log(msg);
	if (err) {
		fb_error = error.message;
		console.log(err);
	}
	next();
};

var handle_authorize = function(code, req, res, next, tries) {
	// attempts
	tries = tries ? tries+1 : 1;

	// clear session
	fb_error = null;
	req.session.fb = {};

	// auth object
	var auth_obj = {
		"redirect_uri":   "http://dev.socialbubba.com/auth/",
		"client_id":      fb_config.client_id,
		"client_secret":  fb_config.client_secret,
		"code":           code
	};

	// swap our 'code' for an access_token
	graph.authorize(auth_obj, function(err, auth_res) {
		// errors :-S
		if (err) {
			if (err.code == 100 && tries < 5) {
				console.log("Recursion {0} ~ https://developers.facebook.com/bugs/419168608133421".format(tries));
				setTimeout(function() { handle_authorize(code, req, res, next, tries) }, 100);
				return;
			}
			return handle_error("Error obtaining Facebook access_token.", auth_res, req, res, next);
		}
		// else 
		console.log("Successfully obtained Facebook access_token.");

		// make api calls using graph
		graph
			.setAccessToken(auth_res.access_token)
			.get("/me?fields=id,name,first_name,last_name,username,email,location,gender,timezone,picture", function(err, me_res) {
				// errors are not our friend
				if (err) {
					return handle_error("Error getting Facebook API {0}.".format('"/me"'), me_res, req, res, next);
				}

				// fix this for the common 
				if (me_res && me_res.picture && me_res.picture.data && me_res.picture.data.url) {
					me_res.picture = me_res.picture.data.url.replace(/^https:/, "http:");
				}
				else {
					me_res.picture = "http://graph.facebook.com/{0}/picture".format(me_res.username); 
				}

				// update session
				var dt_now = new Date();
				var epoch = parseInt(dt_now.getTime() / 1000, 10);
				var expires_at = epoch + parseInt(auth_res.expires, 10);
				var fb_session = {
					access_code: code,
					access_token: auth_res.access_token,
					expires_at: expires_at,
					user_id: me_res.id,
					user: me_res
				};
				req.session.fb = fb_session;

				// update cookie
				var key_payload = { algorithm: "HMAC-SHA256", code: code, issued_at: epoch, user_id: "{0}".format(me_res.id) };
				var base64_payload = "{0}".format(JSON.stringify(key_payload)).base64_url_encode();
				var base64_sig = crypto.createHmac("sha256", fb_config.client_secret).update(base64_payload).digest("base64");
				var base64_sig_fb = base64_sig.replace(/[=]+$/, "").replace(/[+]/g, "-").replace(/[\/]/g, "_");
				res.cookie("fbsr_{0}".format(fb_config.client_id), "{0}.{1}".format(base64_sig_fb, base64_payload));

				next();
			});
	});
};

exports.graph = graph;

exports.set_config = function(arg_config) {
	fb_config = arg_config;
};

exports.get_config = function() {
	return fb_config;
};

exports.get_error = function() {
	return fb_error;
};

exports.check_code = function(req, res, next) {
	if (req.query.code) {
		return handle_authorize(req.query.code, req, res, next);
	}
	if (req.query.error) {
		fb_error = "Access denied by user.";
	}
	next();
};

exports.check_session = function(req, res, next) {
	// first we look for the cookie set by Facebook when a user logs in and authorises an app.
	//   the format of the cookie name is "fbsr_" followed by the Application ID
	var fb_key = "fbsr_{0}".format(fb_config.client_id);
	var fb_cookie = req.cookies[fb_key];

	// if there's no Facebook cookie, the user is not authorized, so we shouldn't proceed further.
	if (!fb_cookie) {
		req.session.fb = {};
		return handle_error("No Facebook cookie detected.", null, req, res, next);
	}

	// the cookie is the same format as a Facebook signed request:
	//   https://developers.facebook.com/docs/authentication/signed_request/
	var base64data = fb_cookie.split(".", 2);
	var payload = "{0}".format(base64data[1]).base64_url_decode();
	var parsedToken = JSON.parse(payload);
	var fb_session = req.session.fb;

	// session user
	if (fb_session && fb_session.user_id == parsedToken.user_id) {
		console.log("Same Facebook user detected.");
		if (fb_session.access_code != parsedToken.code) {
			return handle_authorize(parsedToken.code, req, res, next);
		}
		next();
	}
	else {
		console.log("New Facebook user detected.");
		return handle_authorize(parsedToken.code, req, res, next);
	}
};

exports.logout = function(req, res, next) {
	req.session.fb = {};
	res.clearCookie("fbsr_{0}".format(fb_config.client_id));
	graph.setAccessToken(null);
	next();
};
