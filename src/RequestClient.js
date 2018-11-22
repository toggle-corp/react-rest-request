import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { randomString, resolve } from './utils';
import RequestContext from './RequestContext';

const emptyObject = {};

export const createRequestClient = () => (requests = {}, consume) => (WrappedComponent) => {
    const requestKeys = Object.keys(requests);

    const requestsOnMount = requestKeys.filter(key => requests[key].onMount);
    const requestsOnProps = requestKeys.filter(key => requests[key].onPropsChanged);

    const requestsConsumed = consume || requestKeys;

    class View extends React.PureComponent {
        constructor(props) {
            super(props);

            const uniqueKey = randomString(16);
            this.coordinatorKeys = requestKeys.reduce((acc, key) => ({
                ...acc,
                [key]: requests[key].isUnique ? key : `${uniqueKey}-${key}`,
            }), {});

            this.beforeMountOverrides = requestsOnMount
                .filter(key => requestsConsumed.indexOf(key) >= 0)
                .reduce((acc, key) => ({
                    ...acc,
                    [key]: {
                        pending: true,
                        setDefaultParams: params => this.setDefaultParamsPerRequest(key, params),
                    },
                }), {});

            this.lastProps = {};
            this.newProps = {};

            this.defaultParams = undefined;
            this.defaultParamsPerRequest = {};
        }

        componentDidMount() {
            this.beforeMountOverrides = {};

            const props = this.calculateProps();
            requestsOnMount.forEach((key) => {
                const args = {
                    props,
                    params: this.defaultParamsPerRequest[key] || this.defaultParams,
                };
                if (resolve(requests[key].onMount, args)) {
                    this.startRequest(key, undefined, requests[key].isUnique);
                }
            });
        }

        componentDidUpdate(prevProps) {
            const props = this.calculateProps();

            // For each request that depends on props:
            requestsOnProps.forEach((key) => {
                const propConditions = requests[key].onPropsChanged;
                let propNames;
                let checkCondition;
                let args;

                if (Array.isArray(propConditions)) {
                    propNames = propConditions;
                    checkCondition = false;
                } else {
                    propNames = Object.keys(propConditions);
                    checkCondition = true;
                    args = {
                        prevProps,
                        props,
                        params: this.defaultParamsPerRequest[key] || this.defaultParams,
                    };
                }

                const makeRequest = propNames.some((propName) => {
                    const isModified = this.props[propName] !== prevProps[propName];
                    return isModified && (!checkCondition || resolve(
                        propConditions[propName],
                        args,
                    ));
                });

                if (makeRequest) {
                    this.startRequest(key);
                }
            });
        }

        getPropFor = (key) => {
            // Props need to be memoized.
            // Make sure that prop is not created every time
            // and is only changed when state[accessKey] is changed.

            const accessKey = this.coordinatorKeys[key] || key;
            const prop = this.api.state[accessKey] || emptyObject;
            if (this.lastProps[key] === prop) {
                return this.newProps[key];
            }

            this.newProps[key] = {
                ...prop,
                setDefaultParams: params => this.setDefaultParamsPerRequest(key, params),
                do: params => this.startRequest(key, params),
                abort: () => this.stopRequest(key),
            };
            return this.newProps[key];
        }

        setDefaultParamsPerRequest = (key, params) => {
            this.defaultParamsPerRequest[key] = params;
        }

        setDefaultRequestParams = (params) => {
            this.defaultParams = params;
        }

        stopRequest = (key) => {
            this.api.stopRequest(key);
        }

        startRequest = (key, params, ignoreIfExists) => {
            const request = requests[key];
            const props = this.calculateProps();
            const r = arg => resolve(arg, {
                props,
                params: params || this.defaultParamsPerRequest[key] || this.defaultParams,
            });
            const rMethod = method => method && (args => method({
                props,
                params: params || this.defaultParamsPerRequest[key] || this.defaultParams,
                ...args,
            }));

            this.api.startRequest({
                key: this.coordinatorKeys[key],
                group: r(request.group),
                method: r(request.method),
                url: r(request.url),
                query: r(request.query),
                body: r(request.body),
                options: r(request.options),

                // FIXME: remove callbacks once unmounted
                onSuccess: rMethod(request.onSuccess),
                onFailure: rMethod(request.onFailure),
                onFatal: rMethod(request.onFatal),
            }, ignoreIfExists);
        }

        // Warning: props should not be created every time.
        calculateProps = () => ({
            ...requestsConsumed.reduce((acc, key) => ({
                ...acc,
                [key]: this.getPropFor(key),
            }), {}),
            setDefaultRequestParams: this.setDefaultRequestParams,

            ...this.beforeMountOverrides,
            ...this.props,
        });

        renderWrappedComponent = (api) => {
            this.api = api;
            const props = this.calculateProps();

            return (
                <WrappedComponent {...props} />
            );
        }

        render() {
            return (
                <RequestContext.Consumer>
                    {this.renderWrappedComponent}
                </RequestContext.Consumer>
            );
        }
    }

    return hoistNonReactStatics(
        View,
        WrappedComponent,
    );
};

export default createRequestClient();
