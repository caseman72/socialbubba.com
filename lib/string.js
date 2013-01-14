// these are handy
if (typeof String.prototype.startsWith != "function") {
	console.log( "String.prototype.startsWith" );
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) == str;
	};
}
if (typeof String.prototype.endsWith != "function") {
	console.log( "String.prototype.endsWith" );
	String.prototype.endsWith = function (str) {
		return this.slice(-str.length) == str;
	};
}
if (typeof String.prototype.format != "function") {
	console.log( "String.prototype.format" );
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
	console.log( "String.prototype.base64_url_encode" );
	String.prototype.base64_url_encode = function() {
		var str = "{0}".format(this);
		return new Buffer(str).toString("base64").replace(/[=]*$/, "").replace(/[+]/g, "-").replace(/[\/]/g, "_");
	};
}
if (typeof String.prototype.base64_url_decode != "function") {
	console.log( "String.prototype.base64_url_decode" );
	String.prototype.base64_url_decode = function() {
		var str = "{0}".format( this.replace(/[-]/g, "+").replace(/[_]/g, "/") );
		while (str.length % 4 !== 0) {
			str += "=";
		}
		return new Buffer(str, "base64").toString("utf8");
	};
}
if (typeof String.prototype.number_format != "function") {
	// https://github.com/kvz/phpjs/blob/master/functions/strings/number_format.js
	console.log( "String.prototype.number_format" );
	String.prototype.number_format = function(decimals, dec_point, thousands_sep) {
		var number = "{0}".format(this).replace(/[^0-9+\-Ee.]/g, "");
		var n = !isFinite(+number) ? 0 : +number;
		var prec = !isFinite(+decimals) ? 0 : Math.abs(decimals);
		var sep = (typeof thousands_sep === "undefined") ? "," : thousands_sep;
		var dec = (typeof dec_point === "undefined") ? "." : dec_point;
		var s = "";
		var toFixedFix = function (n, prec) {
			var k = Math.pow(10, prec);
			return "" + Math.round(n * k) / k;
		};
		// Fix for IE parseFloat(0.55).toFixed(0) = 0;
		s = (prec ? toFixedFix(n, prec) : "" + Math.round(n)).split(".");
		if (s[0].length > 3) {
			s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
		}
		if ((s[1] || "").length < prec) {
			s[1] = s[1] || "";
			s[1] += new Array(prec - s[1].length + 1).join("0");
		}
		return s.join(dec);
	};
}


exports = {};
