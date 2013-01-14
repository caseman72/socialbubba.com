// requires
var _ = require("underscore");
var express = require("express");
var mongo_store = require("connect-mongo")(express);
var mongoose = require("mongoose");
var hbs = require("hbs");

var s = require("./lib/string");
var fb = require("./lib/facebook");
var models = require("./lib/models");
var garmin = require("./lib/garmin");

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
models.set_config({client_id: config.fb_client_id, client_secret: config.fb_secret_key});

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
app.get("/", fb.check_session, function(req, res) {
	res.render("index", {
		cache: true,
		layout: "layouts/default",
		title: "Social Bubba",
		fb_appid: config.fb_client_id,
		fb_user: req.session.fb && req.session.fb.user ? req.session.fb.user : null,
		fb_user_flag: req.session.fb && req.session.fb.user ? "true" : "false"
	});
});

var set_profile_id = function(req, res, next) {
	req.profile_id = req.session.fb && req.session.fb.user_id ? req.session.fb.user_id : null;
	next();
};

// profile
app.get("/profile/", fb.check_session, set_profile_id, models.set_profile, function(req, res) {
	// send the list of runs back to the client
	res.render("profile", {
		cache: false,
		layout: "layouts/default",
		title: "Social Bubba ~ Profile",
		fb_appid: config.fb_client_id,
		fb_user: req.session.fb && req.session.fb.user ? req.session.fb.user : null,
		fb_user_flag: req.session.fb && req.session.fb.user ? "true" : "false",
		profile: req.profile
	});
});

// auth/login
app.get(/^\/auth\/login$/, function(req, res) { res.redirect("/auth/login/"); });
app.get("/auth/login/", fb.check_code, function(req, res) { 
	var hash = req.session.fb && req.session.fb.user ? "#success" : "#failed {0}".format(fb.get_error());
	res.redirect("/{0}".format(hash)); 
});

// auth/logout
app.get(/^\/auth\/logout$/, function(req, res) { res.redirect("/auth/logout/"); });
app.get("/auth/logout/", fb.logout, function(req, res) { 
	var hash = req.session.fb && req.session.fb.user ? "#failed" : "#success";
	res.redirect("/{0}".format(hash)); 
});

// tss
app.all(/^\/tss\/([^\/]+)$/, function(req, res) { res.redirect("/tss/{0}/".format(req.params[0])); });
app.get("/tss/:id/", function(req, res) {
	var headers = _.omit(req.headers, "host", "cookie", "x-varnish", "accept-encoding"); // remove our server stuff
	headers["host"] = "connect.garmin.com"; // rejected by garmin if not set to correct domain

	garmin.activity(req.params.id, headers, function(act_err, act_res, act_body) {
		if (act_err) {
			res.json({error: true, msg: 3});
		}
		else {
			var json = JSON.parse(act_body);
			json = json["com.garmin.activity.details.json.ActivityDetails"];

			// hashes
			var metrics_keys = {}
			var metrics_values = {};
			var metrics_averages = {};

			// keys with indexes
			_.each(json.measurements, function(obj) {
				if (obj.key in {directPower: true, directSpeed: true, directBikeCadence: true, directHeartRate: true, sumMovingDuration: true}) {
					metrics_keys[obj.key] = obj.metricsIndex;
				}
			});

			// init values
			_.each(metrics_keys, function(value, key) {
				metrics_values[key] = [];
			});

			// fill
			_.each(json.metrics, function(obj) {
				_.each(metrics_keys, function(value, key) {
					metrics_values[key].push(obj.metrics[value]);
				});
			});

			// total seconds
			var total_seconds = _.last(metrics_values.sumMovingDuration);

			// drop seconds from hashes
			delete metrics_keys.sumMovingDuration;
			delete metrics_values.sumMovingDuration;

			// calculate averages
			_.each(metrics_values, function(values, key) {

				var last_ten = [];
				for(var i=0; i<10; i++) {
					last_ten.push(values[i]);
				}

				var count = 1;
				var sum = Math.pow( (_.reduce(last_ten, function(total, value, index){ return total + value; }, 0) / 10.0) , 4);

				for (var i=10, n=values.length; i<n; i++) {
					last_ten.shift();
					last_ten.push(values[i]);
					sum += Math.pow( (_.reduce(last_ten, function(total, value, index){ return total + value; }, 0) / 10.0) , 4);
					count++;
				}

				metrics_averages[key] = Math.pow( (sum / count), 0.25);
			});

			// TODO - use profile data for the divisors
			//
			var metrics_tss = {};
			if (metrics_averages.directSpeed) {
				var directSpeed = metrics_averages["directSpeed"];
				var directPace = 60 / directSpeed; 

				var tss_directSpeed = (directSpeed/22.0)*(directSpeed/22.0)*total_seconds/3600*100;
				var tss_directPace = (directPace/9.00)*(directPace/9.00)*total_seconds/3600*100;

				if (tss_directSpeed > tss_directPace) {
					metrics_tss["directSpeed"] = tss_directSpeed; 
				}
				else {
					delete metrics_averages.directSpeed;
					metrics_averages["directPace"] = directPace;
					metrics_tss["directPace"] = tss_directPace;
				}
			}

			if (metrics_averages.directHeartRate) {
				var directHeartRate = metrics_averages["directHeartRate"];
				metrics_tss["directHeartRate"] = (directHeartRate/150)*(directHeartRate/150)*total_seconds/3600*100;
			}

			if (metrics_averages.directBikeCadence) {
				var directBikeCadence = metrics_averages["directBikeCadence"];
				metrics_tss["directBikeCadence"] = (directBikeCadence/85)*(directBikeCadence/85)*total_seconds/3600*100;
			}

			if (metrics_averages.directPower) {
				var directPower = metrics_averages["directPower"];
				metrics_tss["directPower"] = (directPower/220)*(directPower/220)*total_seconds/3600*100;
			}

			res.json({averages: metrics_averages, tss: metrics_tss});
		}
	});
});


// garming activities
app.all(/^\/garmin\/activities$/, function(req, res) { res.redirect("/garmin/activities/"); });
app.get("/garmin/activities/", function(req, res) {
	var headers = _.omit(req.headers, "host", "cookie", "x-varnish", "accept-encoding"); // remove our server stuff
	headers["host"] = "connect.garmin.com"; // rejected by garmin if not set to correct domain

	garmin.login("username", "password", headers, function(log_err, log_res, log_body) {
		if (log_err) {
			res.json({error: true, msg: 1});
		}
		else {
			garmin.activities(headers, function(act_err, act_res, act_body) {
				if (act_err) {
					res.json({error: true, msg: 2});
				}
				else {
					res.json(JSON.parse(act_body));
				}
			});
		}
	});
});

// garmin proxy
app.all(/^\/garmin\/activity\/([^\/]+)$/, function(req, res) { res.redirect("/garmin/activity/{0}/".format(req.params[0])); });
app.get("/garmin/activity/:id/", function(req, res) {
	var headers = _.omit(req.headers, "host", "cookie", "x-varnish", "accept-encoding"); // remove our server stuff
	headers["host"] = "connect.garmin.com"; // rejected by garmin if not set to correct domain

	garmin.activity(req.params.id, headers, function(act_err, act_res, act_body) {
		if (act_err) {
			res.json({error: true, msg: 3});
		}
		else {
			res.json(JSON.parse(act_body));
		}
	});
});

// listen!
app.listen(config.server_port, function(){ console.log("Listening on {0}".format(config.server_port)); });
