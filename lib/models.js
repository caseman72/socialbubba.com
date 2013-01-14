var crypto = require("crypto");
var s = require("./string");
var mongoose = require("mongoose");

var models_config = { client_secret: "NeedToSetThis" };

var handle_error = function(msg, err, req, res, next) {
	console.log(msg);
	if (err) {
		console.log(err);
	}
	next();
};

// http://stackoverflow.com/questions/4497135/node-js-and-crypto-library
var aes_encode = function(txt) {
	if (txt) {
		var cipher = crypto.createCipher("aes-256-cbc", models_config.client_secret);
		cipher["complete"] = cipher["final"];
		var crypted = cipher.update(txt, "utf8", "hex");
			crypted += cipher.complete("hex");

		return crypted;
	}
	return null;
};

var aes_decode = function(crypted) {
	if (crypted) {
		try {
			var decipher = crypto.createDecipher("aes-256-cbc", models_config.client_secret);
			decipher["complete"] = decipher["final"];
			var txt = decipher.update(crypted, "hex", "utf8");
				txt += decipher.complete("utf8");
			return txt;
		}
		catch(e) {
			return null;
		}
	}
	return null;
};

var decode_mpm = function(value) {
	var decimal = "{0}".format(value);   // 8:15 or 8'15"

	if (decimal.match(/:/)) {
		var parts = decimal.replace(/[\s]+/g, "").split(":");
		var min = parseInt(parts[0], 10);
		var sec = parseInt(parts[1], 10) / 60.0;
		value = min + sec;
	}
	else if (decimal.match(/'/)) {
		var parts = decimal.replace(/[\s"]+/g, "").split("'");
		var min = parseInt(parts[0], 10);
		var sec = parseInt(parts[1], 10) / 60.0;
		value = min + sec;
	}
	else {
		value = parseFloat(value);
	}

	return value;
};

var encode_mpm = function(value) {
	value = "{0}".format(value);   // 8.50
	var decimal = value.number_format(2);

	if (value.match(/\./)) {
		var parts = value.split(".");
		var min = parseInt(parts[0], 10);
		var dec = (value * 1.0) - min; 
		var sec = parseInt((dec * 60.0)+0.5, 10);
		value = "{0}:{1}".format(min, sec);
	}
	else {
		value = "{0}:00".format(value, '"');
	}

	return {decimal: decimal, string: value};
};

// http://en.wikipedia.org/wiki/Heart_rate
var hr_max = function (age) {
	var hr_max = 0;
	hr_max += 220.0 - age;
	hr_max += 217.0 - (0.85 * age);
	hr_max += 208.0 - (0.7 * age);
	hr_max += 206.9 - (0.67 * age);
	hr_max += 206.3 - (0.711 * age);
	hr_max += 205.8 - (0.685 * age);
	hr_max += 203.7 / (1.0 + Math.exp(0.033 * (age - 104.3)));
	hr_max += 191.5 - (0.007 * age * age);
	hr_max += 163.0 + (1.16 * age) - (0.018 * age * age);

	return parseInt((hr_max / 9.0 + 0.5), 10);
};
exports.hr_max = hr_max;


var profile_schema = new mongoose.Schema({
	profile_id:      { type: String, index: true, unique: true, required: true },
	garmin_username: { type: String },
	garmin_password: { type: String, set: aes_encode, get: aes_decode },
	year_of_birth:   { type: Number },
	run_mpm:         { type: Number, set: decode_mpm,  get: encode_mpm },  // avg minutes per mile for 1 hr
	run_bpm:         { type: Number },  // avg beats per minute for 1 hr
	bike_mph:        { type: Number },  // avg miles per hour for 1 hr
	bike_rpm:        { type: Number },  // avg revs per min avg for 1 hr
	bike_watts:      { type: Number },  // avg watts for 1 hr
	bike_bpm:        { type: Number },  // avg beats per minute for 1 hr
	mtb_mph:         { type: Number },
	mtb_rpm:         { type: Number },
	cross_mph:       { type: Number },
	cross_rpm:       { type: Number },
	swim_yph:        { type: Number }   // total yards in 1 hr
});

var Profile = mongoose.model("Profile", profile_schema);

//	String
//	Number
//	Date
//	Buffer
//	Boolean
//	Mixed
//	ObjectId
//	Array
exports.profile = function() {
	return Profile;
};

exports.set_profile = function(req, res, next) {
	if (req.profile_id) {
		Profile.findOne({profile_id: req.profile_id}, function(err, profile) {
			if (err) {
				return handle_error("Could not retrieve profile.", null, res, req, next);
			}

			// no profile in db - insert
			if (!profile) {
				console.log("No profile ~ create profile.");
				profile = new Profile({profile_id: req.profile_id});
				profile.save(); // no need to wait or error
			}
			req.profile = profile;
			next();
		});
	}
	else {
		req.profile_id = null;
		req.profile = null;
		next();
	}
};

exports.sked = {}

exports.set_config = function(arg_config) {
	models_config = arg_config;
};

exports.get_config = function() {
	return models_config;
};

