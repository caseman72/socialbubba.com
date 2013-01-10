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

// https://github.com/bestiejs/lodash/
$.flutter = function(ticks, func) {
	var _timeout = null;

	return function() {
		var args = arguments;
		var self = this;

		if (_timeout) {
			clearTimeout(_timeout);
		}
		_timeout = setTimeout(function() {
			_timeout = null, func.apply(self, args);
		}, ticks);
	}
};

// condition, global, ready
$.fn.cond_global_ready = function(condition, options) {
	options = options || {};

	var not_in = options.not_in || false;
	var path_name = (""+window.location.pathname);
	var global_cb = options.global;
	var ready_cb = options.ready;

	// test the test condition
	if (condition instanceof RegExp) {
		condition = condition.test(path_name)
	}
	else if ($.isArray(condition) && window.views) {
		var tf = false;
		for (var i=0,n=condition.length; i<n; i++) {
			if (window.views[condition[i]]) {
				tf = true;
				break;
			}
		}
		condition = tf;
	}
	else if (typeof(condition) == "string") {
		condition = (condition == path_name);
	}
	// else {
	//   condition is passed in as a boolean
	// }

	// opposite? switch if 'not_in' is true
	if (not_in) {
		condition = !condition;
	}

	// true? run code
	if (condition) {
		if (typeof(global_cb) == "function") {
			global_cb.call(this);
		}
		if (typeof(ready_cb) == "function") {
			this.ready(ready_cb);
		}
	}
	return this;
};
