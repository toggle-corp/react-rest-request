import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';
import { randomString, resolve, FirstArgument, listToMap } from '@togglecorp/fujs';

import { RequestContext } from './RequestContext';
import {
    CoordinatorAttributes,
    ClientAttributes,
    ExtendedContextState,
    NewProps,
} from './declarations';

const emptyObject = {};

// tslint:disable-next-line max-line-length
// eslint-disable-next-line import/prefer-default-export, max-len
export function createRequestClient<Props extends object, Params>(requests: { [key: string]: ClientAttributes<Props, Params>} = {}, consume?: string[]) {
    return (WrappedComponent: React.ComponentType<NewProps<Props, Params>>) => {
        const requestKeys = Object.keys(requests);
        const requestsOnMount = requestKeys.filter(key => requests[key].onMount);
        const requestsNonPersistent = requestKeys.filter(key => !requests[key].isPersistent);
        const requestsConsumed = consume || requestKeys;

        class View extends React.PureComponent<Props> {
            public static contextType = RequestContext;

            public constructor(props: Props) {
                super(props);

                this.canonicalKeys = this.generateCanonicalKeys(requestKeys);
            }

            public componentWillMount() {
                // call one api here to initialize everything
                const props = this.getProps(this.props);

                requestsOnMount.forEach((key) => {
                    const args = {
                        params: this.getParams(key),
                        props,
                    };
                    const { onMount } = requests[key];

                    if (!!onMount && resolve(onMount, args)) {
                        // Don't actually start the request but be prepared
                        this.startRequest(key, args.params, requests[key].isUnique, true);
                    } else {
                        // Not that any request is running but calling stop makes
                        // sure that request coordinator state is reset for key
                        // and that this client will be rerendered.
                        this.context.stopRequest(key);
                    }
                });
            }

            public componentDidMount() {
                const props = this.getProps(this.props);

                requestsOnMount.forEach((key) => {
                    const args = {
                        params: this.getParams(key),
                        props,
                    };
                    const { onMount } = requests[key];

                    if (!!onMount && resolve(onMount, args)) {
                        this.startRequest(key, args.params, requests[key].isUnique);
                    }
                });
            }

            public componentDidUpdate(prevProps: Props) {
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
                        const { props } = this;
                        const isModified = props[propName] !== prevProps[propName];
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
                        // NOTE: should this also not pass requests[key].isUnique to startRequest
                        this.startRequest(key, args.params);
                    }
                });
            }

            public componentWillUnmount() {
                requestsNonPersistent.forEach((key) => {
                    this.context.stopRequest(key);
                });
            }

            private canonicalKeys: {
                [key: string]: string;
            };

            private lastProps: {
                [key: string]: ExtendedContextState<Params>;
            } = {};

            private defaultParamsPerRequest: {
                [key: string]: Params;
            } = {};

            private defaultParams?: Params;

            private generateCanonicalKeys = (keys: string[]) => {
                const seed = randomString(16);
                return listToMap(
                    keys,
                    key => key,
                    key => (requests[key].isUnique ? key : `${seed}-${key}`),
                );
            }

            private getCanonicalKey = (key: string) => (
                this.canonicalKeys[key] || key
            )

            private getParams = (key: string, params?: Params) => ({
                ...this.defaultParams,
                ...this.defaultParamsPerRequest[key],
                ...params,
            })

            private setDefaultParamsPerRequest = (key: string, params: Params) => {
                this.defaultParamsPerRequest[key] = params;
            }

            private setDefaultRequestParams = (params: Params) => {
                this.defaultParams = params;
            }

            private startRequest = (
                key: string,
                params?: Params,
                ignoreIfExists?: boolean,
                placeholder?: boolean,
            ) => {
                const request = requests[key];
                const myArgs = {
                    params,
                    props: this.getProps(this.props),
                };

                const {
                    // @ts-ignore only capturing these values
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
                    isUnique,
                    // @ts-ignore only capturing these values
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
                    onPropsChanged,
                    // @ts-ignore only capturing these values
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
                    onMount,
                    // @ts-ignore only capturing these values
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
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

                this.context.startRequest(
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

                        // TODO: resolve other methods as well
                        ...otherProps,
                    },
                    ignoreIfExists,
                    placeholder,
                );
            }

            private calculatePropForKey = (key: string) => {
                const accessKey = this.getCanonicalKey(key);
                // NOTE: why set emptyObject as value
                const prop = this.context.state[accessKey] || emptyObject;

                let value = this.lastProps[key];
                const changed = prop !== value;

                // Props need to be memoized.
                // Make sure that prop is not created every time
                // and is only changed when state[accessKey] is changed.
                if (changed) {
                    value = {
                        ...prop,
                        setDefaultParams: (params: Params) => (
                            this.setDefaultParamsPerRequest(key, params)
                        ),
                        do: (params?: Params) => (
                            this.startRequest(key, this.getParams(key, params))
                        ),
                        abort: () => this.context.stopRequest(key),
                    };
                    this.lastProps[key] = value;
                }

                return {
                    key,
                    changed,
                    value,
                };
            }

            private calculateRequests = () => {
                const props = requestsConsumed.map(this.calculatePropForKey);
                // Check if every prop is unchanged
                if (props.every(prop => !prop.changed)) {
                    return this.lastProps;
                }

                return listToMap(
                    props,
                    prop => prop.key,
                    prop => prop.value,
                );
            }

            private getProps = (props: Props) => (
                Object.assign(
                    {
                        setDefaultRequestParams: this.setDefaultRequestParams,
                        requests: this.calculateRequests(),
                    },
                    props,
                )
            )

            public render() {
                const props = this.calculateRequests();

                return (
                    <WrappedComponent
                        setDefaultRequestParams={this.setDefaultRequestParams}
                        requests={props}
                        {...this.props}
                    />
                );
            }
        }

        // tslint:disable-next-line max-line-length
        // eslint-disable-next-line max-len
        return hoistNonReactStatics<React.ComponentType<Props>, React.ComponentType<NewProps<Props, Params>>>(
            View,
            WrappedComponent,
        );
    };
}
