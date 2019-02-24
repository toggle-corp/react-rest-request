import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';
import { randomString, resolve, intersection, FirstArgument } from '@togglecorp/fujs';

import { RequestContext } from './RequestContext';
import {
    CoordinatorAttributes,
    ClientAttributes,
    Context,
    ExtensionState,
    ExtendedContextState,
    NewProps,
} from './declarations';

const emptyObject = {};

export const createRequestClient = <Props extends object, Params>(
    requests: { [key: string]: ClientAttributes<Props, Params>} = {},
    consume?: string[],
) => (
    // tslint:disable-next-line variable-name
    WrappedComponent: React.ComponentType<NewProps<Props, Params>>,
) => {
    const requestKeys = Object.keys(requests);
    const requestsOnMount = requestKeys.filter(key => requests[key].onMount);
    const requestsNonPersistent = requestKeys.filter(key => !requests[key].isPersistent);
    const requestsConsumed = consume || requestKeys;
    const requestsConsumedOnMount = [...intersection(new Set(requestsConsumed), new Set(requestsOnMount))];

    class View extends React.PureComponent<Props> {
        private canonicalKeys: {
            [key: string]: string,
        };
        private beforeMountOverrides: {
            [key: string]: ExtensionState<Params>,
        };

        private lastProps: {
            [key: string]: ExtendedContextState<Params>,
        } = {};

        private defaultParamsPerRequest: {
            [key: string]: Params,
        } = {};
        private defaultParams?: Params;
        private api: Context;

        constructor(props: Props) {
            super(props);

            this.canonicalKeys = this.generateCanonicalKeys(requestKeys);
            this.beforeMountOverrides = this.generateBeforeMountProps(requestsConsumedOnMount);

            // NOTE: placeholder api
            this.api = {
                startRequest: () => console.error('api.startRequest not defined'),
                stopRequest: () => console.error('api.stopRequest not defined'),
                state: {},
            };
        }

        componentDidMount() {
            this.beforeMountOverrides = {};

            requestsOnMount.forEach((key) => {

                const args = {
                    params: this.getParams(key),
                    props: this.getProps(this.props),
                };
                const { onMount } = requests[key];

                if (!!onMount && resolve(onMount, args)) {
                    this.startRequest(key, args.params, requests[key].isUnique);
                } else {
                    // Not that any request is running but calling stop makes
                    // sure that request coordinator state is reset for key
                    // and that this client will be rerendered.
                    this.api.stopRequest(key);
                }
            });
        }

        componentWillUnmount() {
            requestsNonPersistent.forEach((key) => {
                this.api.stopRequest(key);
            });
        }

        componentDidUpdate(prevProps: Props) {
            // For each request that depends on props:
            requestKeys.forEach((key) => {
                const { onPropsChanged } = requests[key];
                if (!onPropsChanged) {
                    return;
                }

                const propNames: string[] = Array.isArray(onPropsChanged)
                    ? onPropsChanged as string[]
                    : Object.keys(onPropsChanged);

                const args = {
                    prevProps,
                    props: this.getProps(this.props),
                    params: this.getParams(key),
                };

                const makeRequest = propNames.some((propName) => {
                    const isModified = this.props[propName] !== prevProps[propName];
                    if (!isModified) {
                        return false;
                    }
                    if (!Array.isArray(onPropsChanged)) {
                        const onPropsChangedForProp = onPropsChanged[propName];
                        return resolve(onPropsChangedForProp, args);
                    }
                    return true;
                });

                if (makeRequest) {
                    this.startRequest(key, args.params);
                }
            });
        }

        private generateBeforeMountProps = (requestsConsumedOnMount: string[]) => {
            return requestsConsumedOnMount
                .reduce(
                    (acc, key) => ({
                        ...acc,
                        [key]: {
                            pending: true,
                            setDefaultParams: (params: Params) => (
                                this.setDefaultParamsPerRequest(key, params)
                            ),
                        },
                    }),
                    {},
                );
        }

        private generateCanonicalKeys = (keys: string[]) => {
            const seed = randomString(16);
            return keys.reduce(
                (acc, key) => ({
                    ...acc,
                    [key]: requests[key].isUnique ? key : `${seed}-${key}`,
                }),
                {},
            );
        }

        private getCanonicalKey = (key: string) => {
            return this.canonicalKeys[key] || key;
        }

        private getParams = (key: string, params?: Params) => {
            return {
                ...this.defaultParams,
                ...this.defaultParamsPerRequest[key],
                ...params,
            };
        }

        private setDefaultParamsPerRequest = (key: string, params: Params) => {
            this.defaultParamsPerRequest[key] = params;
        }

        private setDefaultRequestParams = (params: Params) => {
            this.defaultParams = params;
        }

        private startRequest = (key: string, params?: Params, ignoreIfExists?: boolean) => {
            const request = requests[key];
            const myArgs = {
                params,
                props: this.getProps(this.props),
            };

            const {
                // @ts-ignore only capturing these values
                isUnique,
                // @ts-ignore only capturing these values
                onPropsChanged,
                // @ts-ignore only capturing these values
                onMount,
                // @ts-ignore only capturing these values
                isPersistent,

                onSuccess,
                onFailure,
                onFatal,

                group,
                method,
                url,
                query,
                body,
                options,
                extras,

                ...otherProps
            } = request;

            type onSuccessArgument = FirstArgument<CoordinatorAttributes['onSuccess']>;
            type onFailureArgument = FirstArgument<CoordinatorAttributes['onFailure']>;
            type onFatalArgument = FirstArgument<CoordinatorAttributes['onFatal']>;

            this.api.startRequest(
                {
                    key: this.getCanonicalKey(key),

                    group: resolve(group, myArgs),
                    method: resolve(method, myArgs),
                    url: resolve(url, myArgs),
                    query: resolve(query, myArgs),
                    body: resolve(body, myArgs),
                    options: resolve(options, myArgs),
                    extras: resolve(extras, myArgs),

                    onSuccess: (args: onSuccessArgument) => {
                        if (onSuccess) {
                            onSuccess({ ...args, ...myArgs });
                        }
                    },
                    onFailure: (args: onFailureArgument) => {
                        if (onFailure) {
                            onFailure({ ...args, ...myArgs });
                        }
                    },
                    onFatal: (args: onFatalArgument) => {
                        if (onFatal) {
                            onFatal({ ...args, ...myArgs });
                        }
                    },

                    // FIXME: resolve other methods as well
                    ...otherProps,
                },
                ignoreIfExists,
            );
        }

        private calculatePropForKey = (key: string) => {
            const accessKey = this.getCanonicalKey(key);
            const prop = this.api.state[accessKey] || emptyObject;

            // Props need to be memoized.
            // Make sure that prop is not created every time
            // and is only changed when state[accessKey] is changed.
            if (prop === this.lastProps[key]) {
                return { key, changed: false, value: this.lastProps[key] };
            }

            const newProps = {
                ...prop,
                setDefaultParams: (params: Params) => this.setDefaultParamsPerRequest(key, params),
                do: (params?: Params) => this.startRequest(key, this.getParams(key, params)),
                abort: () => this.api.stopRequest(key),
            };

            this.lastProps[key] = newProps;

            return { key, changed: true, value: newProps };
        }

        private calculateRequests = () => {
            const props = requestsConsumed.map(this.calculatePropForKey);
            // Check if every prop is unchanged
            if (props.every(props => !props.changed)) {
                return {
                    ...this.beforeMountOverrides,
                    ...this.lastProps,
                };
            }

            return props.reduce(
                (acc, prop) => ({
                    ...acc,
                    [prop.key]: prop.value,
                }),
                { ...this.beforeMountOverrides },
            );
        }

        private renderWrappedComponent = (api: Context) => {
            this.api = api;
            const props = this.calculateRequests();

            return (
                <WrappedComponent
                    setDefaultRequestParams={this.setDefaultRequestParams}
                    requests={props}
                    {...this.props}
                />
            );
        }

        private getProps = (props: Props) => {
            return Object.assign(
                {
                    setDefaultRequestParams: this.setDefaultRequestParams,
                    requests: this.calculateRequests(),
                },
                props,
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

    // tslint:disable-next-line max-line-length
    return hoistNonReactStatics<React.ComponentType<Props>, React.ComponentType<NewProps<Props, Params>>>(
        View,
        WrappedComponent,
    );
};
