import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { CoordinatorAttributes, Context } from './declarations';
import { RequestContext } from './RequestContext';
import {
    RestRequest,
    prepareUrlParams,
    HandlerFunc,
} from './RestRequest';

const emptyObject = {};

interface Request {
    running: boolean;
    data: CoordinatorAttributes;
    stop(): void;
    start(): void;
}

interface Attributes<Props, NewProps>{
    transformUrl?(url: string, props: Props): string;
    transformProps(props: Props): NewProps;
    transformParams(data: CoordinatorAttributes, props: Props): object;
    transformResponse?(body: object, data: CoordinatorAttributes): object;
    transformErrors?(body: object, data: CoordinatorAttributes): object;
}

export const createRequestCoordinator = <Props, NewProps>(
    attributes: Attributes<Props,
    NewProps>,
) => (
    // tslint:disable-next-line variable-name
    WrappedComponent: React.ComponentType<NewProps>,
) => {
    const {
        transformParams,
        transformResponse,
        transformErrors,
        transformProps,
        transformUrl,
    } = attributes;

    class Coordinator extends React.Component<Props, Context['state']> {
        private mounted: boolean = false;
        private requests: { [key:string]: Request } = {};
        private requestGroups: { [key: string]: string[] } = {};

        constructor(props: Props) {
            super(props);
            this.state = {};
        }

        componentDidMount() {
            this.mounted = true;
            this.forEachRequest(request => request.start());
        }

        componentWillUnmount() {
            this.forEachRequest(request => request.stop());
            this.mounted = false;
        }

        private forEachRequest = (callback: (data: Request) => void) => {
            Object.keys(this.requests).forEach((key) => {
                callback(this.requests[key]);
            });
        }

        private stopRequest: Context['stopRequest'] = (key) => {
            this.setState({ [key]: { pending: false } }, () => {
                const request = this.requests[key];
                if (request) {
                    request.stop();
                }
            });
        }

        private startRequest: Context['startRequest'] = (requestData, ignoreIfExists) => {
            const {
                key,
                group,
                url,
                query,
                options = {},
            } = requestData;

            const oldRequest = this.requests[key];

            if (oldRequest && oldRequest.running) {
                if (ignoreIfExists) {
                    return;
                }
                oldRequest.stop();
            }

            const calculateParams = () => {
                return transformParams(requestData, this.props)
            };

            const appendage = query && prepareUrlParams(query);
            const preparedUrl = appendage && appendage.length > 0 ? `${url}?${appendage}` : url;

            const request = new RestRequest({
                ...options,
                key,
                url: transformUrl ? transformUrl(preparedUrl, this.props) : preparedUrl,
                params: calculateParams,
                onPreLoad: this.handlePreLoad,
                onAfterLoad: this.handleAfterLoad,
                onAbort: this.handleAbort,
                onSuccess: this.handleSuccess,
                onFailure: this.handleFailure,
                onFatal: this.handleFatal,
            });

            this.requests[key] = {
                data: requestData,
                running: false,
                stop: () => {
                    request.stop();
                    this.requests[key].running = false;
                },
                start: () => {
                    // Force preload to set proper state before request actually start
                    this.handlePreLoad(key);
                    this.requests[key].running = true;
                    request.start();
                },
            };

            if (group) {
                if (!this.requestGroups[group]) {
                    this.requestGroups[group] = [key];
                } else {
                    this.requestGroups[group].push(key);
                }
            }

            if (this.mounted) {
                this.requests[key].start();
            }
        }

        private handlePreLoad = (key: string) => {
            const newState = { pending: true };

            // Calculate group state
            const { data: { group } } = this.requests[key];
            const groupState = group ? {
                [group]: {
                    pending: true,
                },
            } : emptyObject;

            this.setState({ [key]: newState, ...groupState });
        }

        private handleRequestDone = (key: string) => {
            const requestState = this.state[key] || emptyObject;
            const newState = {
                ...requestState,
                pending: false,
            };

            // Calculate group state
            const { data: { group } } = this.requests[key];
            const groupState = group ? {
                [group]: {
                    pending: this.requestGroups[group]
                        .filter(k => k !== key)
                        .some(k => !!this.state[k].pending),
                },
            } : emptyObject;

            this.setState({ [key]: newState, ...groupState });
        }

        private handleAfterLoad = (key: string) => {
            this.handleRequestDone(key);
        }

        private handleAbort = (key: string) => {
            this.handleRequestDone(key);
        }

        private handleSuccess: HandlerFunc = (key, body, status) => {
            const { data } = this.requests[key];

            let response;
            try {
                response = transformResponse ? transformResponse(body, data) : body;
            } catch (e) {
                this.handleFatal(key, e, 0);
                return;
            }

            const { onSuccess } = data;
            if (onSuccess) {
                onSuccess({ response, status });
            }

            const requestState = this.state[key] || emptyObject;
            const newState = {
                ...requestState,
                response,
                responseError: undefined,
                responseStatus: status,
            };
            this.setState({ [key]: newState });
        }

        private handleFailure: HandlerFunc = (key, body, status) => {
            const { data } = this.requests[key];

            let error;
            try {
                error = transformErrors ? transformErrors(body, data) : body;
            } catch (e) {
                this.handleFatal(key, e, 0);
                console.error(e);
                return;
            }

            const { onFailure } = data;
            if (onFailure) {
                onFailure({ error, status });
            }

            const requestState = this.state[key] || emptyObject;
            const newState = {
                ...requestState,
                response: undefined,
                responseError: error,
                responseStatus: status,
            };
            this.setState({ [key]: newState });
        }

        private handleFatal: HandlerFunc = (key, error, status) => {
            const { data } = this.requests[key];
            const { onFatal } = data;
            if (onFatal) {
                onFatal({ error });
            }

            const requestState = this.state[key] || emptyObject;
            const newState = {
                ...requestState,
                response: undefined,
                responseError: error,
                responseStatus: status,
            };
            this.setState({ [key]: newState });
        }

        render() {
            const contextApi = {
                startRequest: this.startRequest,
                stopRequest: this.stopRequest,
                state: this.state,
            };

            const newProps = transformProps(this.props);

            return (
                <RequestContext.Provider value={contextApi}>
                    <WrappedComponent {...newProps} />
                </RequestContext.Provider>
            );
        }
    }

    return hoistNonReactStatics<React.ComponentType<Props>, React.ComponentType<NewProps>>(
        Coordinator,
        WrappedComponent,
    );
};
