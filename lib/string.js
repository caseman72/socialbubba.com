// these are handy
if (typeof String.prototype.startsWith != "function") {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) == str;
	};
}
if (typeof String.prototype.endsWith != "function") {
	String.prototype.endsWith = function (str) {
		return this.slice(-str.length) == str;
	};
}
if (typeof String.prototype.format != "function") {
	String.prototype.format = function() {
		var args = arguments;
		var argn = arguments.length;
		var refx = function (str, i) {
			i = parseInt(i, 10);
			return i>=0 && i<argn ? args[i] : str;
		}
		return this.replace(/{([^{}]*)}/g, refx);
	};
}
if (typeof String.prototype.base64_url_encode != "function") {
	String.prototype.base64_url_encode = function() {
		var str = "{0}".format(this);
		return new Buffer(str).toString("base64").replace(/[=]*$/, "").replace(/[+]/g, "-").replace(/[\/]/g, "_");
	};
}
if (typeof String.prototype.base64_url_decode != "function") {
	String.prototype.base64_url_decode = function() {
		var str = "{0}".format( this.replace(/[-]/g, "+").replace(/[_]/g, "/") );
		while (str.length % 4 !== 0) {
			str += "=";
		}
		return new Buffer(str, "base64").toString("utf8");
	};
}
exports = {};
