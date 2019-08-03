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

/*
interface Verbosity {
    showLog?: boolean;
    showError?: boolean;
    showWarning?: boolean;

    showRequest?: boolean;
    showResponse?: boolean;
}
*/

interface Attributes<Props, NewProps>{
    // verbosity: Verbosity;
    transformUrl?(url: string, props: Props): string;
    transformProps(props: Props): NewProps;
    transformParams(data: CoordinatorAttributes, props: Props): object;
    transformResponse?(body: object, data: CoordinatorAttributes): object;
    transformErrors?(body: object, data: CoordinatorAttributes): object;
}

interface Request {
    running: boolean;
    data: CoordinatorAttributes;
    stop(): void;
    start(): void;
}

// eslint-disable-next-line import/prefer-default-export, max-len
export const createRequestCoordinator = <Props, NewProps>(attributes: Attributes<Props, NewProps>) => (WrappedComponent: React.ComponentType<NewProps>) => {
    const {
        transformParams,
        transformResponse,
        transformErrors,
        transformProps,
        transformUrl,
    } = attributes;

    class Coordinator extends React.Component<Props, Context['state']> {
        public constructor(props: Props) {
            super(props);
            this.state = {};
            // store information about every request
            // Coordinator updates response, responseError and responseStatus
        }

        public componentDidMount() {
            this.mounted = true;
            this.forEachRequest(request => request.start());
        }

        public componentWillUnmount() {
            this.forEachRequest(request => request.stop());
            this.mounted = false;
        }

        private mounted: boolean = false;

        private requests: { [key: string]: Request } = {};

        private requestGroups: { [key: string]: string[] } = {};

        private forEachRequest = (callback: (data: Request) => void) => {
            Object.keys(this.requests).forEach((key) => {
                callback(this.requests[key]);
            });
        }

        // called as api by children
        private stopRequest: Context['stopRequest'] = (key) => {
            this.setState({ [key]: { pending: false } }, () => {
                const request = this.requests[key];
                if (request) {
                    request.stop();
                }
            });
        }

        // called as api by children
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

            const calculateParams = () => (
                transformParams(requestData, this.props)
            );

            const appendage = query && prepareUrlParams(query);
            const preparedUrl = appendage && appendage.length > 0 ? `${url}?${appendage}` : url;

            const request = new RestRequest({
                ...options,
                key,
                url: transformUrl ? transformUrl(preparedUrl, this.props) : preparedUrl,
                params: calculateParams,
                onPreLoad: this.handleRequestStart,
                onInitialize: this.handleRequestStart,
                onAfterLoad: this.handleRequestDone,
                onAbort: this.handleRequestDone,
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

        private handleRequestStart = (key: string) => {
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
            const { state } = this;
            const requestState = state[key] || emptyObject;
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
                        .some(k => !!state[k].pending),
                },
            } : emptyObject;

            this.setState({ [key]: newState, ...groupState });
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

            const { state } = this;
            const requestState = state[key] || emptyObject;
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

            const { state } = this;
            const requestState = state[key] || emptyObject;
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

            const { state } = this;
            const requestState = state[key] || emptyObject;
            const newState = {
                ...requestState,
                response: undefined,
                responseError: error,
                responseStatus: status,
            };
            this.setState({ [key]: newState });
        }

        public render() {
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
