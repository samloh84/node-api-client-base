const Promise = require('bluebird');
const _ = require('lodash');
const axios = require('axios');
const FormData = require('form-data')

class ApiClient {
    /**
     *
     * @param params
     * @param params.baseUrl
     * @param params.hostname
     * @param params.port
     * @param params.protocol
     * @param params.pathname
     * @param params.authCallback
     * @param params.token
     * @param params.username
     * @param params.password
     * @param params.baseUrl
     * @param params.authHeaders
     * @param params.credentials
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
            this._protocol = _.get(params, 'protocol', 'https')
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

    _buildUrl() {
        let resolvedUrl = new URL(this._basePath, `${this._protocol}://${this._hostname}:${this._port}`);
        let args = _.flattenDeep(arguments);
        let relativePath = _.join(args, '/');
        resolvedUrl = new URL(relativePath, resolvedUrl);
        resolvedUrl = resolvedUrl.toString();
        return resolvedUrl;
    }

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


    _request() {
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

                let contentTypeHeader = _.get(config, ['headers', 'content-type']);
                data = _.get(config, 'data');
                if (contentTypeHeader === 'multipart/form-data' && !_.isNil(data)) {
                    if (!(data instanceof FormData)) {
                        data = ApiClient._serializeObjectToFormData(data);
                        _.set(config, 'data', data);
                    }

                    let formDataHeaders = data.getHeaders(_.get(config, ['headers'], {}));
                    _.set(config, 'headers', formDataHeaders);
                }

                apiClient._authenticate(config);

                return axios.request(config)
                    .then(function (response) {
                        return _.get(response, 'data');
                    });
            });
    }


    _get() {
        return this._request(...arguments, 'get');
    }

    _head(urlPath, params, config) {
        return this._request(...arguments, 'head');

    }

    _delete(urlPath, params, config) {
        return this._request(...arguments, 'delete');
    }

    _options(urlPath, params, config) {
        return this._request(...arguments, 'options');
    }

    _put(urlPath, data, config) {
        return this._request(...arguments, 'put');
    }

    _post(urlPath, data, config) {
        return this._request(...arguments, 'post');
    }

    _patch(urlPath, data, config) {
        return this._request(...arguments, 'patch');
    }


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


class EntityCrudApi {
    constructor(apiClient, entityUrlBasePathname) {
        this._apiClient = apiClient;
        this._entityUrlBasePathname = entityUrlBasePathname;
    }

    _resolveUrlSlug(id) {
        let entityCrudApi = this;
        let entityUrlBasePathname = entityCrudApi._entityUrlBasePathname;
        if (_.isNil(id)) {
            return [entityUrlBasePathname, id];
        } else {
            return [entityUrlBasePathname];
        }

    }

    list(params, config) {
        let entityCrudApi = this;
        let apiClient = entityCrudApi._apiClient;
        return apiClient._get(entityCrudApi._resolveUrlSlug(), params, config);
    }

    create(data, config) {
        let entityCrudApi = this;
        let apiClient = entityCrudApi._apiClient;
        return apiClient._post(entityCrudApi._resolveUrlSlug(), data, config);
    }

    read(id, params, config) {
        let entityCrudApi = this;
        let apiClient = entityCrudApi._apiClient;
        return apiClient._get(entityCrudApi._resolveUrlSlug(id), params, config);
    }

    update(id, data, config) {
        let entityCrudApi = this;
        let apiClient = entityCrudApi._apiClient;
        return apiClient._put(entityCrudApi._resolveUrlSlug(id), data, config);
    }

    delete(id, params, config) {
        let entityCrudApi = this;
        let apiClient = entityCrudApi._apiClient;
        return apiClient._delete(entityCrudApi._resolveUrlSlug(id), params, config);
    }
}

module.exports = {ApiClient, EntityCrudApi};