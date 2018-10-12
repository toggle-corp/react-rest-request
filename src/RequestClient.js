import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { randomString, resolve } from './utils';
import RequestContext from './RequestContext';

const emptyObject = {};

export const createRequestClient = () => (requests = {}, consume) => {
    const uniqueKey = randomString(16);

    const requestKeys = Object.keys(requests);
    const coordinatorKeys = requestKeys.reduce((acc, key) => ({
        ...acc,
        [key]: requests[key].isUnique ? key : `${uniqueKey}-${key}`,
    }), {});

    const requestsOnMount = requestKeys.filter(key => requests[key].onMount);
    const requestsOnProps = requestKeys.filter(key => requests[key].onPropsChanged);

    const requestsConsumed = consume || requestKeys;

    return (WrappedComponent) => {
        class View extends React.PureComponent {
            constructor(props) {
                super(props);

                this.beforeMountOverrides = requestsOnMount
                    .filter(key => requestsConsumed.indexOf(key) >= 0)
                    .reduce((acc, key) => ({
                        ...acc,
                        [key]: {
                            pending: true,
                        },
                    }), {});

                this.lastProps = {};
                this.newProps = {};
            }

            componentDidMount() {
                this.beforeMountOverrides = {};
                requestsOnMount.forEach(
                    key => this.startRequest(key, undefined, requests[key].isUnique),
                );
            }

            componentDidUpdate(prevProps) {
                // For each request that depends on props:
                requestsOnProps.forEach((key) => {
                    const propNames = requests[key].onPropsChanged;

                    // For each prop on which the request depends,
                    // if there is one that has been updated,
                    // make the request (again).
                    const isPropModifed = propNames.some(
                        propName => this.props[propName] !== prevProps[propName],
                    );
                    if (isPropModifed) {
                        this.startRequest(key);
                    }
                });
            }

            getPropFor = (key) => {
                // Props need to be memoized.
                // Make sure that prop is not created every time
                // and is only changed when state[accessKey] is changed.

                const accessKey = coordinatorKeys[key] || key;
                const prop = this.api.state[accessKey] || emptyObject;
                if (this.lastProps[key] === prop) {
                    return this.newProps[key];
                }

                this.newProps[key] = {
                    ...prop,
                    do: params => this.startRequest(key, params),
                };
                return this.newProps[key];
            }

            startRequest = (key, params, ignoreIfExists) => {
                const { props } = this;
                const request = requests[key];
                const r = arg => resolve(arg, { props, params });

                this.api.startRequest({
                    key: coordinatorKeys[key],
                    group: r(request.group),
                    method: r(request.method),
                    url: r(request.url),
                    query: r(request.query),
                    body: r(request.body),
                    onSuccess: args => request.onSuccess({ props, params, ...args }),
                    onFailure: args => request.onFailure({ props, params, ...args }),
                    onFatal: args => request.onFatal({ props, params, ...args }),
                }, ignoreIfExists);
            }

            // Warning: props should not be created every time.
            calculateProps = () => ({
                ...requestsConsumed.reduce((acc, key) => ({
                    ...acc,
                    [key]: this.getPropFor(key),
                }), {}),

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
