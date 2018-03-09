'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.FUNCTION = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _fetch = require('./fetch');

var _types = require('admin-on-rest/lib/rest/types');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var FUNCTION = exports.FUNCTION = 'FUNCTION';

function filterQuery(obj, pointers) {
	var result = {};
	Object.keys(obj).forEach(function (x) {
		if (typeof (obj[x]) === 'string') {
			result[x] = { "$regex": obj[x] };
        } else {
            const object = obj[x];
            if (object.objectId && pointers && typeof pointers === 'object' && pointers[x]) {
            	const className = pointers[x];
                const pointer = { "__type": "Pointer",
                     "className": className,
                    "objectId": object.objectId
                };
                result[x] = pointer;
			}
			else {
                result[x] = object;
			}
        }
	});
	if (Object.keys(result).length > 0) {
		return JSON.stringify(result);
    }
	return null;
}

function cleanUpSortField(field) {
	return field.replace('.iso', '');
}

function deleteFileForObject(fileObj, key, value, params, baseUrl, requestHeaders) {
	return Promise.resolve().then(function () {
        if (value && value.name) {
        	console.log("key = ", key);
            var _options = {};
            _options.method = 'DELETE';
            _options.headers = requestHeaders;
            const fileName = fileObj.name;
            // const url = baseUrl + '/files/' + fileName;
			// must remove the App ID portion which is between filename and 'files' in the path
            // const fileName = fileUrl.substring(fileUrl.lastIndexOf("/") + 1)
            // const urlPath = fileUrl.substring(0, fileUrl.lastIndexOf("files"));
            // const url = urlPath + "files/" + fileName;
            const url = baseUrl + '/files/' + fileName;
            return fetch(url, _options)
                .then(function(response) {
                    return response.json();
                })
                .then(function(json) {
                    console.log("response = ", json);
                    console.log("successfully deleted - ", fileName)
                    return params;
                });
        } else {
            return params;
        }
	}).catch(function (error) {
		console.log("error deleting file = ", error);
		//catch error and swallow
		return params;
	});
}

function uploadFileForObject(fileObj, key, value, params, baseUrl, requestHeaders) {
	return Promise.resolve().then(function () {
        if (fileObj && fileObj.rawFile && fileObj.rawFile.name && fileObj.rawFile.type) {
            var _options = {};
            _options.method = 'POST';
            _options.headers = requestHeaders;
            _options.body = fileObj.rawFile;
            const fileName = encodeURIComponent(fileObj.rawFile.name);
            const url = baseUrl + '/files/' + fileName;
            return fetch(url, _options)
                .then(function(response) {
                    return response.json();
                })
                .then(function(json) {
                    if (json && json.name && json.url) {
                        console.log("successfully uploaded - ", fileName)

                        // update params
                        const fileData = {
                            name: json.name,
                            url: json.url,
                            __type: "File"
                        };
                        params.data[key] = fileData;
                    }
                    // delete old file
                    return deleteFileForObject(fileObj, key, value, params, baseUrl, requestHeaders);
                });
        } else {
            throw new Error('File Object not valid ');
		}
	});
}

function checkForFileUpdates(params, options, baseUrl) {
	var obj = params.data;
	var promises = [];
    Object.keys(obj).forEach(function (key) {
    	const val = obj[key];
        if (val && typeof (val) === 'object') {
            if (val.__type && val.__type === 'File') {
            	const url = val.url;
            	if (url && Array.isArray(url) && url.length > 0) {
            		const fileObj = url[0];
					const rawFile = fileObj.rawFile;

                    promises.push( uploadFileForObject(fileObj, key, val, params, baseUrl, options.headers));
				}
			}
        }
    });
    return Promise.all(promises).then(function () {
    	return params;
	});
}

exports.default = function (parseConfig) {
	var httpClient = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _fetch.fetchJson;


	/**
  * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
  * @param {String} resource Name of the resource to fetch, e.g. 'posts'
  * @param {Object} params The REST request params, depending on the type
  * @returns {Object} { url, options } The HTTP request parameters
  */
	var convertRESTRequestToHTTP = function convertRESTRequestToHTTP(type, resource, params) {
		var url = '';

		var token = localStorage.getItem('parseToken');

		var options = {};
		options.headers = new Headers({ Accept: 'application/json' });
		options.headers.set('X-Parse-Application-Id', parseConfig['APP-ID']);
		options.headers.set('X-Parse-REST-API-Key', parseConfig['REST-API-KEY']);

		if (token !== null) {
			options.headers.set('X-Parse-Session-Token', token);
		}

        if (parseConfig.useMasterKey && parseConfig['MASTER-KEY']) {
            options.headers.set('X-Parse-Master-Key', parseConfig['MASTER-KEY']);
        }

		switch (type) {
			case _types.GET_LIST:
				{
					var page = params.pagination && params.pagination.page != null ? params.pagination.page : 1;
					var perPage = params.pagination && params.pagination.perPage != null ? params.pagination.perPage : 10;
					var field = params.sort && params.sort.field != null ? cleanUpSortField(params.sort.field) : "createdAt";
					var order = params.sort && params.sort.order != null ? params.sort.order : "ASC";
					var include = params.include != null ? params.include.replace(/\s/g, "") : null;
					var pointers = null;
					// extract pointers to use for relational queries
					if (params.filter && params.filter.pointers) {
						pointers = params.filter.pointers;
						delete params.filter.pointers;
					}
					// extract include to use for relational data
                    if (!include && params.filter && params.filter.include) {
                        include = params.filter.include.replace(/\s/g, "");
                        delete params.filter.include;
                    }
                    var filter = params.filter != null ? filterQuery(params.filter, pointers) : null;

                    var query = {
						count: 1,
						order: order === "DESC" ? "-" + field : field,
						limit: perPage,
						skip: (page - 1) * perPage
					};
					if (include != null) {
						query.include = include;
					}
					if (filter != null) {
						query.where = filter;
					}
					url = parseConfig.URL + '/classes/' + resource + '?' + (0, _fetch.queryParameters)(query);
					break;
				}
			case _types.GET_ONE:
				url = parseConfig.URL + '/classes/' + resource + '/' + params.id;
				break;
			case _types.GET_MANY:
				{
					var _query = {
						where: JSON.stringify({ "objectId": { "$in": params.ids } })
					};
					url = parseConfig.URL + '/classes/' + resource + '?' + (0, _fetch.queryParameters)(_query);
					break;
				}
			case _types.GET_MANY_REFERENCE:
				{
					var _page = params.pagination && params.pagination.page != null ? params.pagination.page : 1;
					var _perPage = params.pagination && params.pagination.perPage != null ? params.pagination.perPage : 10;
					var _field = params.sort && params.sort.field != null ? cleanUpSortField(params.sort.field) : "createdAt";
					var _order = params.sort && params.sort.order != null ? params.sort.order : "ASC";

                    var include = params.include != null ? params.include.replace(/\s/g, "") : null;
                    if (!include && params.filter && params.filter.include) {
                        include = params.filter.include.replace(/\s/g, "");
                        delete params.filter.include;
                    }
                    var filter = params.filter != null ? filterQuery(params.filter) : null;

                    var pointer = { "__type": "Pointer",
						"className": params.targetPointerClass,
						"objectId": params.id
					};
					var val = params.targetPointerClass ? pointer : params.id;
					var _query2 = {
						order: _order === "DESC" ? "-" + _field : _field,
						limit: _perPage,
						skip: (_page - 1) * _perPage,
						where: filter ? filter : JSON.stringify(_defineProperty({}, params.target, val))
					};
                    if (include != null) {
                        _query2.include = include;
                    }
					url = parseConfig.URL + '/classes/' + resource + '?' + (0, _fetch.queryParameters)(_query2);
					break;
				}
			case _types.UPDATE:
				url = parseConfig.URL + '/classes/' + resource + '/' + params.id;
				options.method = 'PUT';
                return checkForFileUpdates(params, options, parseConfig.URL)
					.then(function (updatedParams) {
						if (updatedParams) {
							params = updatedParams;
						}
                        delete params.data.id;
                        delete params.data.createdAt;
                        delete params.data.updatedAt;
                        options.body = JSON.stringify(params.data);
						return {url: url, options: options};
					});

				break;
			case _types.CREATE:
				url = parseConfig.URL + '/classes/' + resource;
				options.method = 'POST';
				options.body = JSON.stringify(params.data);
				break;
			case _types.DELETE:
				url = parseConfig.URL + '/classes/' + resource + '/' + params.id;
				options.method = 'DELETE';
				break;
			case FUNCTION:
				url = parseConfig.URL + '/functions/' + resource;
				options.method = 'POST';
				options.body = JSON.stringify(params.data);
				break;
			default:
				throw new Error('Unsupported fetch action type ' + type);
		}

        return Promise.resolve({url: url, options: options});
	};

	/**
  * @param {Object} response HTTP response from fetch()
  * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
  * @param {String} resource Name of the resource to fetch, e.g. 'posts'
  * @param {Object} params The REST request params, depending on the type
  * @returns {Object} REST response
  */
	var convertHTTPResponseToREST = function convertHTTPResponseToREST(response, type, resource, params) {
		var json = response.json;

		switch (type) {
			case _types.GET_LIST:
			case _types.GET_MANY_REFERENCE:
				return {
					data: json.results.map(function (x) {
						return _extends({}, x, { id: x.objectId });
					}),
					total: json.count
				};
			case _types.CREATE:
			case _types.GET_ONE:
			case _types.UPDATE:
			case _types.DELETE:
				return {
					data: _extends({}, json, { id: json.objectId })
				};
			case _types.GET_MANY:
				return {
					data: json.results.map(function (x) {
						return _extends({}, x, { id: x.objectId });
					})
				};
			default:
				return json;
		}
	};

	/**
  * @param {string} type Request type, e.g GET_LIST
  * @param {string} resource Resource name, e.g. "posts"
  * @param {Object} payload Request parameters. Depends on the request type
  * @returns {Promise} the Promise for a REST response
  */
	// return function (type, resource, params) {
	// 	var _convertRESTRequestTo = convertRESTRequestToHTTP(type, resource, params),
	// 	    url = _convertRESTRequestTo.url,
	// 	    options = _convertRESTRequestTo.options;
    //
	// 	return (0, _fetch.fetchJson)(url, options).then(function (response) {
	// 		return convertHTTPResponseToREST(response, type, resource, params);
	// 	});
	// };
    return function (type, resource, params) {

        return convertRESTRequestToHTTP(type, resource, params)
			.then(function (request) {
                return (0, _fetch.fetchJson)(request.url, request.options);
			})
			.then(function (response) {
                return convertHTTPResponseToREST(response, type, resource, params);
            });
    };
};