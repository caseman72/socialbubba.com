var _ = require("underscore");
var request = require("request");
var s = require("./string");

var jar = request.jar();

exports.login = function(user, pwd, headers, callback) {
	// todo pass in user/pwd
	var form = {
		"login": "login",
		"login:signInButton": "Sign In",
		"javax.faces.ViewState": "j_id1",
		"login:loginUsernameField": "{0}".format(user),
		"login:password": "{0}".format(pwd),
		"login:rememberMe": "on"
	};

	request.get("http://connect.garmin.com/signin", {jar: jar, headers: headers}, function(out_err, out_res, out_body) {
		if (!out_err && out_res.statusCode == 200) {
			request.post("https://connect.garmin.com/signin", {jar: jar, form: form, headers: headers}, function(in_err, in_res, in_body) {
				if (!in_err && in_res.statusCode == 302) {
					callback(false, in_res, in_body);
				}
				else {
					callback(true, in_res, in_body);
				}
			});
		}
		else {
			callback(true, out_res, out_body);
		}
	});
};


exports.activity = function(id, headers, callback) {
	request.get("http://connect.garmin.com/proxy/activity-service-1.2/json/activityDetails/{0}/?maxSize=1000".format(id), {jar: jar, headers: headers}, function(out_err, out_res, out_body) {
		if (!out_err && out_res.statusCode == 200) {
			callback(false, out_res, out_body);
		}
		else {
			callback(true, out_res, out_body);
		}
	});
};

exports.activities = function(headers, callback) {
	request.get("http://connect.garmin.com/proxy/activity-search-service-1.0/json/activities?start=0&limit=10", {jar: jar, headers: headers}, function(out_err, out_res, out_body) {
		if (!out_err && out_res.statusCode == 200) {
			callback(false, out_res, out_body);
		}
		else {
			callback(true, out_res, out_body);
		}
	});
};


//  uri || url - fully qualified uri or a parsed url object from url.parse()
//  qs - object containing querystring values to be appended to the uri
//  method - http method, defaults to GET
//  headers - http headers, defaults to {}
//  body - entity body for POST and PUT requests. Must be buffer or string.
//  form - when passed an object this will set body but to a querystring representation of value and adds Content-type: application/x-www-form-urlencoded; charset=utf-8 header. When passed no option a FormData instance is returned that will be piped to request.
//  json - sets body but to JSON representation of value and adds Content-type: application/json header. Additionally, parses the response body as json.
//  multipart - (experimental) array of objects which contains their own headers and body attribute. Sends multipart/related request. See example below.
//  followRedirect - follow HTTP 3xx responses as redirects. defaults to true.
//  followAllRedirects - follow non-GET HTTP 3xx responses as redirects. defaults to false.
//  maxRedirects - the maximum number of redirects to follow, defaults to 10.
//  encoding - Encoding to be used on setEncoding of response data. If set to null, the body is returned as a Buffer.
//  pool - A hash object containing the agents for these requests. If omitted this request will use the global pool which is set to node's default maxSockets.
//  pool.maxSockets - Integer containing the maximum amount of sockets in the pool.
//  timeout - Integer containing the number of milliseconds to wait for a request to respond before aborting the request
//  proxy - An HTTP proxy to be used. Support proxy Auth with Basic Auth the same way it's supported with the url parameter by embedding the auth info in the uri.
//  oauth - Options for OAuth HMAC-SHA1 signing, see documentation above.
//  strictSSL - Set to true to require that SSL certificates be valid. Note: to use your own certificate authority, you need to specify an agent that was created with that ca as an option.
//  jar - Set to false if you don't want cookies to be remembered for future use or define your custom cookie jar (see examples section)
//  aws - object containing aws signing information, should have the properties key and secret as well as bucket unless you're specifying your bucket as part of the path, or you are making a request that doesn't use a bucket (i.e. GET Services)

