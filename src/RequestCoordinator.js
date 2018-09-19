import PropTypes from 'prop-types';
import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { mapToList, noOp, identity, resolve } from './utils';
import RestRequest from './RestRequest';
import RequestContext from './RequestContext';


const emptyObject = {};

export const RestApiPropType = PropTypes.shape({
    request: PropTypes.func.isRequired,
    get: PropTypes.func.isRequired,
    post: PropTypes.func.isRequired,
});

export const createRequestCoordinator = ({
    transformParams = identity,
    /* TODO
    transformResponse = identity,
    transformErrors = identity,
    */
} = {}) => (mapPropsToRequest = emptyObject, consumeAll = true) => {
    const propsBasedRequests = mapToList(
        mapPropsToRequest,
        (element, key) => ({ ...element, key }),
    );

    return (WrappedComponent) => {
        class View extends React.PureComponent {
            constructor(props) {
                super(props);

                this.restApi = {
                    request: this.request,
                    get: this.createRequestFor(RestRequest.GET),
                    post: this.createRequestFor(RestRequest.POST),
                    put: this.createRequestFor(RestRequest.PUT),
                    patch: this.createRequestFor(RestRequest.PATCH),
                    delete: this.createRequestFor(RestRequest.DELETE),
                };

                this.requests = {};
                this.requestPending = {};
                this.requestData = {};

                this.state = {};
                propsBasedRequests.forEach(({ key, id: idVar }) => {
                    const id = resolve(idVar) || key;
                    if (!this.requestPending[key]) {
                        this.requestPending[key] = {};
                    }
                    this.requestPending[key][id] = true;

                    const pendingKey = `${key}Pending`;
                    this.state[pendingKey] = true;
                });

                this.mounted = false;
            }

            componentDidMount() {
                this.forEachRequest(request => request.start());
                this.mounted = true;

                propsBasedRequests.forEach(({ key, map }) => {
                    this.restApi.request(key, resolve(map, this.props));
                });
            }

            componentWillReceiveProps(nextProps) {
                propsBasedRequests.forEach(({ key, map, dependencies = [] }) => {
                    if (dependencies.find(d => this.props[d] !== nextProps[d])) {
                        this.restApi.request(key, resolve(map, nextProps));
                    }
                });
            }

            componentWillUnmount() {
                this.mounted = false;
                this.forEachRequest(request => request.stop());
            }

            forEachRequest = (callback) => {
                Object.keys(this.requests).forEach((key) => {
                    Object.keys(this.requests[key]).forEach((id) => {
                        callback(this.requests[key][id]);
                    });
                });
            }

            createRequestFor = method => (key, { ...args }) => (
                this.request(key, { ...args, method })
            )

            request = (key, requestData) => {
                const {
                    url: urlVar,
                    id: idVar,
                    method: methodVar,
                    body: bodyVar,
                    query: queryVar,
                    params: paramsVar = {},
                    onSuccess = noOp,
                    onFailure = noOp,
                } = requestData;

                let url = resolve(urlVar);

                if (queryVar) {
                    const query = resolve(queryVar);
                    const queryString = RestRequest.prepareUrlParams(query);
                    url = `${url}?${queryString}`;
                }

                const id = resolve(idVar) || key;

                // We use params as a function so that it is recalculated
                // on every retry of the request.
                // For example the transformParams, which may fetch latest
                // authorization token, may need to be called every time.
                const recalculateParams = () => {
                    const params = {
                        headers: RestRequest.jsonHeaders,
                        ...transformParams(resolve(paramsVar), this.props),
                    };
                    if (bodyVar) {
                        params.body = JSON.stringify(resolve(bodyVar));
                    }
                    params.method = resolve(methodVar) || RestRequest.GET;
                    return params;
                };

                const uniqueKey = !idVar ? key : `${key}-${id}`;
                this.requestData[uniqueKey] = {
                    key,
                    id,
                    url,
                    params: recalculateParams,
                    onSuccess,
                    onFailure,
                };

                if (!this.requests[key]) {
                    this.requests[key] = {};
                }

                if (!this.requestPending[key]) {
                    this.requestPending[key] = {};
                }

                if (this.requests[key][id]) {
                    this.requests[key][id].stop();
                }

                const newRequest = new RestRequest({
                    key: uniqueKey,
                    url,
                    params: recalculateParams,
                    onPreLoad: this.handlePreLoad,
                    onPostLoad: this.handlePostLoad,
                    onAbort: this.handleAbort,
                    onSuccess: this.handleSuccess,
                    onFailure: this.handleFailure,
                    onFatal: this.handleFatal,
                });

                this.requests[key][id] = newRequest;

                this.setState({
                    [`${uniqueKey}Error`]: undefined,
                    [uniqueKey]: undefined,
                }, () => {
                    if (this.mounted) {
                        newRequest.start();
                    }
                });
            }

            refreshPending = (key) => {
                const isPending = Object.keys(this.requestPending[key]).some(id =>
                    this.requestPending[key][id]);
                const pendingKey = `${key}Pending`;
                if (this.state[pendingKey] !== isPending) {
                    this.setState({ [pendingKey]: isPending });
                }
            }

            handlePreLoad = (uniqueKey) => {
                const { key, id } = this.requestData[uniqueKey];
                this.requestPending[key][id] = true;
                this.refreshPending(key);
            }

            handlePostLoad = (uniqueKey) => {
                const { key, id } = this.requestData[uniqueKey];
                this.requestPending[key][id] = false;
                this.refreshPending(key);
            }

            handleAbort = (uniqueKey) => {
                const { key, id } = this.requestData[uniqueKey];
                this.requestPending[key][id] = false;
                this.refreshPending(key);
            }

            handleSuccess = (uniqueKey, body, status) => {
                const { onSuccess } = this.requestData[uniqueKey];
                onSuccess(body, status);

                this.setState({
                    [uniqueKey]: body,
                });
            }

            handleFailure = (uniqueKey, body, status) => {
                const { onFailure } = this.requestData[uniqueKey];
                onFailure(body, status);

                this.setState({
                    [`${uniqueKey}Error`]: body,
                });
            }

            handleFatal = (uniqueKey, error) => {
                this.setState({
                    [`${uniqueKey}Error`]: error,
                });
            }

            render() {
                const props = consumeAll ? {
                    ...this.state,
                    ...this.props,
                } : this.props;

                this.contextApi = { ...this.state };

                return (
                    <RequestContext.Provider value={this.contextApi}>
                        <WrappedComponent
                            restApi={this.restApi}
                            {...props}
                        />
                    </RequestContext.Provider>
                );
            }
        }

        return hoistNonReactStatics(
            View,
            WrappedComponent,
        );
    };
};

export default createRequestCoordinator();
