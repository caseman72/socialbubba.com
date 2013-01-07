// requires
var _ = require("underscore");
var express = require("express");
var mongo_store = require("connect-mongo")(express);
var mongoose = require("mongoose");
var restler = require("restler");

// custom globals
var app = express.createServer();
var port = process.env.VCAP_APP_PORT || 3000;
var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
var mongo_dbs = "mongodb-1.8" in services ? services["mongodb-1.8"] : [];
var mongo_urls = {};

// create a mongo url hash
for (var i=0,n=mongo_dbs.length; i<n; i++) {
	mongo_urls[mongo_dbs[i].name] = mongo_dbs[i].credentials.url;
}

// this app's config
var config = {
	mongo_db: "mongo_devsb" in mongo_urls ? mongo_urls["mongo_devsb"] : "mongodb://localhost/mongo_devsb",
	session_salt: "2b3d9de508625d683b9ab81c"
};

// connect to db
mongoose.connect(config.mongo_db);

// app setup
app
	.use(express.logger())
	.use(express.cookieParser(config.session_salt))
	.use(express.session({secret: config.session_salt, store: new mongo_store({url: config.mongo_db})}))
	.use(express.bodyParser())
	.use(app.router)
	.use(express.static(__dirname + "/public"))
	.use(express.favicon(__dirname + "/public/favicon.ico"))
	.use(express.errorHandler({ dumbExceptions: true }))
	.enable("strict routing")
	.enable("jsonp callback");

// index
app.get("/", function(req, res) {
	res.sendfile("./public/index.htm");
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

app.listen(port, function(){ console.log("Listening on " + port) });
