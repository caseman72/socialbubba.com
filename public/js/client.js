$(document).ready(function() {
	if (window.fb_user) {
		$("#fb-button-logout").show().bind("click", function() {
			window.location = "/auth/logout/";
		});
	}
	else {
		$("#fb-button-login").show().bind("click", function() {
			window.location = "https://www.facebook.com/dialog/oauth?client_id={0}&redirect_uri={1}&response_type=code".format(window.fb_appid, encodeURIComponent("http://dev.socialbubba.com/auth/login/"));
		});
	}

	// remove hash from url - a little blink
	if (window.location.hash) {
		var url = "{0}{1}".format(window.location.pathname, window.location.search);

		// TODO: handle errors here
		console.log( window.location.hash );

		// failed ~ refresh otherwise replace
		if ("replaceState" in window.history) {
			history.replaceState("", document.title, url);
		}
		else {
			window.location.replace(url);
		}
	}
});
