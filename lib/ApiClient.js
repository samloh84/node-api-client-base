const Promise = require('bluebird');
const _ = require('lodash');
const axios = require('axios');
const FormData = require('form-data')

/**
 * @callback authCallback
 * @param {axios.AxiosRequestConfig} config
 */

module.exports = class ApiClient {
    /**
     *
     * @param {Object} params Configuration for ApiClient
     * @param {string} params.baseUrl Base URL to resolve URL slugs. If baseUrl is not defined, uses hostname, port, protocol and pathname to construct Base URL.
     * @param {string} params.hostname Hostname of API endpoint.
     * @param {number} params.port Port of API endpoint.
     * @param {string} params.protocol Protocol of API endpoint.
     * @param {string} params.pathname Path of API endpoint.
     * @param {authCallback} params.authCallback Function to modify request to include authentication credentials.
     * @param {object} params.credentials  If supplied, sets the authentication credentials for the ApiClient.
     * @param {string} params.credentials.token If token is supplied, uses Authorization bearer token access header to authenticate request.
     * @param {string} params.credentials.username If username and password is supplied, uses HTTP Basic authentication access header to authenticate request.
     * @param {string} params.credentials.password If username and password is supplied, uses HTTP Basic authentication access header to authenticate request.
     * @param {Object.<string,string>} params.credentials.authHeaders If supplied, uses custom headers to authenticate request.
     */
    constructor(params) {
        let baseUrl = _.get(params, 'baseUrl');

        if (!_.isNil(baseUrl)) {
            baseUrl = new URL(baseUrl);
            this._hostname = baseUrl.hostname;
            this._port = baseUrl.port;
            this._protocol = baseUrl.protocol;
            this._basePath = baseUrl.pathname;
        } else {
            this._hostname = _.get(params, 'hostname');
            this._port = _.get(params, 'port', 443);
            this._basePath = _.get(params, 'basePath');
            this._protocol = _.get(params, 'protocol', 'https:')
        }


        if (_.has(params, 'authCallback')) {
            this._authCallback = _.get(params, 'authCallback');
        }


        if (_.has(params, 'token')) {
            let token = _.get(params, 'token');
            this._credentials = {token: token};
        } else if (_.has(params, 'username') && _.has(params, 'password')) {
            let username = _.get(params, 'username');
            let password = _.get(params, 'password');
            this._credentials = {username: username, password: password};
        } else if (_.has(params, 'authHeaders')) {
            let authHeaders = _.get(params, 'authHeaders');
            this._credentials = {authHeaders};
        } else {
            this._credentials = _.get(params, 'credentials', {});
        }
    }

    /**
     * @param {...(string|string[])} urlSlugs URL slugs to append to API client base URL.
     * @returns {string}
     * @private
     */
    _buildUrl(urlSlugs) {
        let baseUrl = new URL(this._basePath, `${this._protocol}//${this._hostname}:${this._port}`);
        let args = _.flattenDeep(arguments);
        let relativePath = './' + _.join(args, '/');
        let resolvedUrl = new URL(relativePath, baseUrl);
        return resolvedUrl.toString();
    }

    /**
     * Adds Authentication to a Request
     * @param {axios.AxiosRequestConfig} config
     * @returns {axios.AxiosRequestConfig}
     * @private
     */
    _authenticate(config) {

        if (_.isNil(config)) {
            config = {};
        }

        if (!_.isEmpty(this._authCallback)) {
            this._authCallback(config);
        } else {

            if (_.has(this._credentials, 'token')) {
                let token = _.get(this._credentials, 'token');
                _.set(config, ['headers', 'Authorization'], `Bearer ${token}`);
            } else if (_.has(this._credentials, 'username') && _.has(this._credentials, 'password')) {
                let username = _.get(this._credentials, 'username');
                let password = _.get(this._credentials, 'password');
                _.set(config, ['auth'], {username, password});
            } else if (_.has(this._credentials, 'authHeaders')) {
                let authHeaders = _.get(this._credentials, 'authHeaders');
                _.each(authHeaders, function (value, header) {
                    _.set(config, ['headers', header], value);
                })
            }
        }

        return config;
    }


    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [paramsOrData] Depending on the config request method, this object will be used as the params or data for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _parseArgs(urlSlugs, paramsOrData, config) {
        let apiClient = this;
        let numArgs = _.size(arguments);
        let defaultMethod = _.last(arguments);

        let args = _.slice(arguments, 0, numArgs - 1);
        numArgs = _.size(args);
        let configObjectArgs = _.takeRightWhile(args, arg => {
            return _.isPlainObject(arg) || _.isNil(arg)
        });
        let numConfigObjectArgs = _.size(configObjectArgs);
        let resolveUrlArgs = _.slice(args, 0, numArgs - numConfigObjectArgs);

        return ApiClient._deepResolve(configObjectArgs)
            .then(function (resolvedConfigObjectArgs) {
                let url = apiClient._buildUrl(...resolveUrlArgs);

                let method = defaultMethod, params = null, data = null,
                    config = {};

                if (numConfigObjectArgs === 1) {
                    if (!_.isNil(resolvedConfigObjectArgs[0])) {
                        config = resolvedConfigObjectArgs[0];
                    }
                } else if (numConfigObjectArgs === 2) {
                    if (!_.isNil(resolvedConfigObjectArgs[1])) {
                        config = resolvedConfigObjectArgs[1];
                    }

                    let method = _.get(config, 'method', defaultMethod).toLowerCase();

                    if (!_.isNil(resolvedConfigObjectArgs[0])) {
                        if (method === 'put' || method === 'post' || method === 'patch') {
                            data = resolvedConfigObjectArgs[0];
                        } else {
                            params = resolvedConfigObjectArgs[0];
                        }
                    }

                } else {
                    if (!_.isNil(resolvedConfigObjectArgs[0])) {
                        params = resolvedConfigObjectArgs[0];
                    }
                    if (!_.isNil(resolvedConfigObjectArgs[1])) {
                        data = resolvedConfigObjectArgs[1];
                    }

                    config = _.assign({}, ..._.slice(resolvedConfigObjectArgs, 2));
                }

                if (_.isNil(config)) {
                    config = {};
                }

                _.defaults(config, {url, method, data, params});
                return config;
            });
    }


    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [paramsOrData] Depending on the config request method, this object will be used as the params or data for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @param {string} method Method of request
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _request(urlSlugs, paramsOrData, config, method) {
        let apiClient = this;
        return apiClient._parseArgs(...arguments)
            .then(function (config) {
                let contentTypeHeaderKey = _.find(_.keys(_.get(config, ['headers'])), (key) => _.toLower(key) === 'content-type');
                let contentTypeHeader = _.get(config, ['headers', contentTypeHeaderKey]);
                let data = _.get(config, 'data');
                if (contentTypeHeader === 'multipart/form-data' && !_.isNil(data)) {
                    if (!(data instanceof FormData)) {
                        data = ApiClient._serializeObjectToFormData(data);
                        _.set(config, 'data', data);
                    }

                    let formDataHeaders = data.getHeaders();
                    _.set(config, 'headers', _.merge({}, _.get(config, 'headers', {}), formDataHeaders));
                }

                apiClient._authenticate(config);

                return axios.request(config)
                    .then(function (response) {
                        let responseData = _.get(response, 'data');
                        let paginationCallback = _.get(config, 'paginationCallback');
                        if (!_.isNil(paginationCallback)) {

                            let responseDataArray = [responseData];
                            let nextConfig = paginationCallback(responseData, config);

                            function paginationRequest(config) {
                                return axios.request(config)
                                    .then(function (paginationResponse) {
                                        let paginationResponseData = _.get(paginationResponse, 'data');
                                        responseDataArray.push(paginationResponseData);
                                        let nextConfig = paginationCallback(paginationResponseData, config);
                                        if (!_.isNil(nextConfig)) {
                                            return paginationRequest(config);
                                        }
                                    })
                            }

                            let nextRequestPromise = _.isNil(nextConfig) ? Promise.resolve() : paginationRequest(nextConfig);

                            return nextRequestPromise
                                .then(function () {
                                    return responseDataArray;
                                })

                        }

                        return responseData;
                    });
            });
    }


    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [params] Query params for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _get(urlSlugs, params, config) {
        return this._request(...arguments, 'get');
    }

    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [params] Query params for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _head(urlSlugs, params, config) {
        return this._request(...arguments, 'head');

    }

    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [params] Query params for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _delete(urlSlugs, params, config) {
        return this._request(...arguments, 'delete');
    }

    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [params] Query params for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _options(urlSlugs, params, config) {
        return this._request(...arguments, 'options');
    }

    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [data] Data for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _put(urlSlugs, data, config) {
        return this._request(...arguments, 'put');
    }

    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [data] Data for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _post(urlSlugs, data, config) {
        return this._request(...arguments, 'post');
    }

    /**
     * @param {(string|string[])} [urlSlugs] URL slugs to append to API client base URL.
     * @param {object} [data] Data for the Request
     * @param {axios.AxiosRequestConfig} [config] Request config objects
     * @returns {PromiseLike<axios.AxiosRequestConfig> | Promise<axios.AxiosRequestConfig>}
     * @private
     */
    _patch(urlSlugs, data, config) {
        return this._request(...arguments, 'patch');
    }


    /**
     *
     * @param {(object|object[]|Promise.<object>|Promise.<object[]>)} object Object
     * @returns {Promise.<object|object[]>}
     * @private
     */
    static _deepResolve(object) {
        if (_.isPlainObject(object)) {
            return Promise.props(_.mapValues(object, ApiClient._deepResolve));
        } else if (_.isArray(object)) {
            return Promise.map(object, ApiClient._deepResolve);
        } else {
            return Promise.resolve(object);
        }
    }

    static _serializeObjectToFormData(object, formData, path) {
        if (_.isNil(formData)) {
            formData = new FormData();
        }
        if (_.isNil(path)) {
            path = '';
        }

        if (_.isUndefined(object)) {
            return formData;
        } else if (_.isBoolean(object)) {
            formData.append(path, object === true ? "true" : "false")
        } else if (_.isArray(object)) {

            if (_.isEmpty(object)) {
                let key = `${path}[]`;
                formData.append(key, '');
            } else {
                _.each(object, function (value) {
                    let key = `${path}[]`;
                    ApiClient._serializeObjectToFormData(value, formData, key);
                })
            }
        } else if (_.isDate(object)) {
            formData.append(path, object.toISOString());
        } else if (_.isPlainObject(object)) {
            _.each(object, function (value, property) {
                let key = _.isEmpty(path) ? property : `${path}['${property}']`;
                ApiClient._serializeObjectToFormData(value, formData, key);
            })
        } else {
            formData.append(path, object);
        }

        return formData;
    }

}

