'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _adminOnRest = require('admin-on-rest');

exports.default = function (parseConfig) {

	var manageAuth = function manageAuth(type, params) {
		var headers = new Headers({
			'Content-Type': 'application/json',
			'X-Parse-Application-Id': parseConfig['APP-ID'],
			'X-Parse-REST-API-Key': parseConfig['REST-API-KEY']
		});

		if (type === _adminOnRest.AUTH_LOGIN) {
			var username = params.username,
			    password = params.password;

			var request = new Request(parseConfig.URL + '/login?username=' + encodeURIComponent(username) + "&password=" + encodeURIComponent(password), {
				method: 'GET',
				headers: headers
			});
			return fetch(request).then(function (response) {
				if (response.status < 200 || response.status >= 300) {
					throw new Error(response.statusText);
				}
				return response.json();
			}).then(function (response) {
				localStorage.setItem('parseToken', response.sessionToken);
			});
		}
		if (type === _adminOnRest.AUTH_LOGOUT) {
			if (localStorage.getItem('parseToken')) {
				headers.set('X-Parse-Session-Token', localStorage.getItem('parseToken'));
				var _request = new Request(parseConfig.URL + '/logout', {
					method: 'POST',
					headers: headers
				});
				return fetch(_request).then(function (response) {
					localStorage.removeItem('parseToken');
					if (response.status < 200 || response.status >= 300) {
						response.json().then(function (object) {
							if (object.code !== 209) {
								throw new Error(object.error);
							}
						});
					}
				});
			}
			localStorage.removeItem('parseToken');
			return Promise.resolve();
		}
		if (type === _adminOnRest.AUTH_ERROR) {
			var status = params.status;

			if (status === 209) {
				localStorage.removeItem('parseToken');
				return Promise.reject();
			}
			return Promise.resolve();
		}
		if (type === _adminOnRest.AUTH_CHECK) {
			return localStorage.getItem('parseToken') ? Promise.resolve() : Promise.reject();
		}
		return Promise.reject('Unkown method');
	};

	return function (type, params) {
		return manageAuth(type, params);
	};
};

module.exports = exports['default'];