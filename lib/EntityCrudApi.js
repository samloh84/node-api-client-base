const _ = require('lodash');

module.exports = class EntityCrudApi {
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

