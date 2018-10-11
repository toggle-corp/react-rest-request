import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { randomString, resolve, capitalize } from './utils';
import RequestContext from './RequestContext';

const emptyObject = {};

export const createRequestClient = () => (requests = {}, consume) => {
    const uniqueKey = randomString(16);

    const requestKeys = Object.keys(requests);
    const coordinatorKeys = requestKeys.reduce((acc, key) => ({
        ...acc,
        [key]: requests[key].isUnique ? key : `${uniqueKey}-${key}`,
    }), {});

    const requestsOnMount = requestKeys.filter(key =>
        requests[key].onMount);
    const requestsOnProps = requestKeys.filter(key =>
        requests[key].onPropsChanged);
    const requestsToCall = requestKeys.filter(key =>
        requests[key].callProp);

    const requestsConsumed = consume || requestKeys;

    return (WrappedComponent) => {
        class View extends React.PureComponent {
            constructor(props) {
                super(props);

                // Can be optimized by filtering out not consumed keys
                this.beforeMountOverrides = requestsOnMount.reduce((acc, key) => ({
                    ...acc,
                    [key]: {
                        pending: true,
                    },
                }), {});

                this.constantProps = requestsToCall.reduce((acc, key) => ({
                    ...acc,
                    [`do${capitalize(key)}`]: params => this.startRequest(key, params),
                }), {});
            }

            componentDidMount() {
                this.beforeMountOverrides = {};
                requestsOnMount.forEach(key =>
                    this.startRequest(key, undefined, requests[key].isUnique));
            }

            componentDidUpdate(prevProps) {
                // For each request that depends on props:
                requestsOnProps.forEach((key) => {
                    const propNames = requests[key].onPropsChanged;

                    // For each prop on which the request depends,
                    // if there is one that has been updated,
                    // make the request (again).
                    const isPropModifed = propNames.some(propName =>
                        this.props[propName] !== prevProps[propName]);
                    if (isPropModifed) {
                        this.startRequest(key);
                    }
                });
            }

            startRequest = (key, params, ignoreIfExists) => {
                const request = requests[key];
                const r = arg => resolve(arg, this.props, params);

                this.api.startRequest({
                    key: coordinatorKeys[key],
                    method: r(request.method),
                    url: r(request.url),
                    query: r(request.query),
                    body: r(request.body),
                    onSuccess: request.onSuccess,
                    onFailure: request.onFailure,
                    onFatal: request.onFatal,
                }, ignoreIfExists);
            }

            // Warning: following object should not create
            // new values every time.
            calculateProps = () => ({
                // This won't create new values as long as the api state[key]
                // is not created every time.
                ...requestsConsumed.reduce((acc, key) => ({
                    ...acc,
                    [key]: this.api.state[coordinatorKeys[key]] || emptyObject,
                }), {}),

                ...this.constantProps,
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
};

export default createRequestClient();
