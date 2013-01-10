// requires
var s = require("./lib/string");
var _ = require("underscore");
var express = require("express");
var mongo_store = require("connect-mongo")(express);
var mongoose = require("mongoose");
var restler = require("restler");
var crypto = require("crypto");
var hbs = require("hbs");

var fb = require("./lib/facebook");

// process.env reduced by used keys
var process_env = _.pick(process.env, "FB_CLIENT_ID", "FB_SECRET_KEY", "SESSION_SALT", "VCAP_APP_PORT", "VCAP_SERVICES");

// prevent express from defining mount and then overriding it
if (typeof(express.mount) !== "undefined") {
	throw new Error('typeof(express.mount) !== "undefined")');
}
// fix google closure error by mapping static to mount
express["mount"] = express["static"];

// mongo db url from environment - defaults to localhost 
var mongo_db_url = (function (db_key, env) {
	var services = JSON.parse(env.VCAP_SERVICES || "{}");
	var mongo_dbs = "mongodb-1.8" in services ? services["mongodb-1.8"] : [];
	var mongo_urls = {};

	// create a mongo url hash
	for (var i=0,n=mongo_dbs.length; i<n; i++) {
		mongo_urls[mongo_dbs[i].name] = mongo_dbs[i].credentials.url;
	}

	// defaults to localhost
	return db_key in mongo_urls ? mongo_urls[db_key] : "mongodb://localhost/mongo_devsb";
})("mongo_devsb", process_env);

// this app's secret config values - don't print/log
var config = {
	mongo_db: mongo_db_url,
	server_port: process_env.VCAP_APP_PORT || 3000,
	session_salt: process_env.SESSION_SALT || "",
	fb_client_id: process_env.FB_CLIENT_ID || "",
	fb_secret_key: process_env.FB_SECRET_KEY || ""
};

// facebook config values
fb.set_config({client_id: config.fb_client_id, client_secret: config.fb_secret_key});

// connect to db
mongoose.connect(config.mongo_db);

// app setup
var app = express.createServer();
app
	.use(express.logger())
	.use(express.cookieParser(config.session_salt))
	.use(express.session({secret: config.session_salt, store: new mongo_store({url: config.mongo_db})}))
	.use(express.bodyParser())
	.use(app.router)
	.use(express.mount(__dirname + "/public")) // previously static
	.use(express.favicon(__dirname + "/public/favicon.ico"))
	.use(express.errorHandler({ dumbExceptions: true }))
	.engine("mhtm", hbs.__express)
	.set("view engine", "mhtm")
	.set("views", __dirname + "/views")
	.enable("strict routing")
	.enable("jsonp callback");

// index
app.get("/index.htm", function(req, res) { res.redirect("/"); });
app.get("/", fb.check_session, function(req, res) {
	res.render("index", {
		cache: true,
		layout: "layouts/default",
		title: "Social! Bubba",
		fb_appid: config.fb_client_id,
		fb_user: req.session.fb && req.session.fb.user ? req.session.fb.user : null,
		fb_user_flag: req.session.fb && req.session.fb.user ? "true" : "false"
	});
});

// auth
app.get(/^\/auth$/, function(req, res) { res.redirect("/auth/"); });
app.get("/auth/", fb.check_code, function(req, res) { 
	var hash = req.session.fb && req.session.fb.user ? "#success" : "#failed {0}".format(fb.get_error());
	res.redirect("/{0}".format(hash)); 
});

// logout
app.get(/^\/logout$/, function(req, res) { res.redirect("/logout/"); });
app.get("/logout/", fb.logout, function(req, res) { 
	var hash = req.session.fb && req.session.fb.user ? "#failed" : "#success";
	res.redirect("/{0}".format(hash)); 
});

// garmin proxy
app.all(/^\/garmin\/([^\/]+)$/, function(req, res) { res.redirect("/garmin/" + req.params[0] + "/"); });
app.get("/garmin/:id/", function(req, res) {
	var headers = _.omit(req.headers, "host", "cookie", "x-varnish"); // remove our server stuff
	headers["host"] = "connect.garmin.com"; // rejected by garmin if not set to correct domain
	restler
		.get("http://connect.garmin.com/proxy/activity-service-1.2/json/activityDetails/"+ req.params.id +"/?maxSize=1000", {headers: headers})
		.on("complete", function(data) {
			res.json(data);
		});
});

app.listen(config.server_port, function(){ console.log("Listening on " + config.server_port) });

