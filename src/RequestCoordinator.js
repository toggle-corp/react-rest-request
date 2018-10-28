import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import { identity } from './utils';
import RestRequest from './RestRequest';
import RequestContext from './RequestContext';

const emptyObject = {};

export const createRequestCoordinator = ({
    transformParams = identity,
    transformResponse = identity,
    transformErrors = identity,
    transformProps = identity,
    transformUrl = identity,
} = {}) => (WrappedComponent) => {
    class View extends React.PureComponent {
        constructor(props) {
            super(props);

            this.mounted = false;
            this.requests = {};
            this.state = {};
            this.requestGroups = {};
        }

        componentDidMount() {
            this.mounted = true;
            this.forEachRequest(request => request.start());
        }

        componentWillUnmount() {
            this.forEachRequest(request => request.stop());
            this.mounted = false;
        }

        forEachRequest = (callback) => {
            Object.keys(this.requests).forEach((key) => {
                callback(this.requests[key]);
            });
        }

        stopRequest = (key) => {
            this.setState({ [key]: {} }, () => {
                const oldRequest = this.requests[key];
                if (oldRequest) {
                    oldRequest.stop();
                }
            });
        }

        startRequest = (requestData, ignoreIfExists) => {
            const {
                method,
                key,
                group,
                url,
                query,
                body,
                options,
            } = requestData;

            const oldRequest = this.requests[key];

            if (oldRequest && oldRequest.running) {
                if (ignoreIfExists) {
                    return;
                }
                oldRequest.stop();
            }

            const calculateParams = () => {
                const params = {
                    method,
                    headers: RestRequest.jsonHeaders,
                };
                if (body) {
                    params.body = JSON.stringify(body);
                }
                return transformParams(params, this.props);
            };

            const preparedUrl = !query ? url : `${url}?${RestRequest.prepareUrlParams(query)}`;

            const request = new RestRequest({
                key,
                url: transformUrl(preparedUrl, this.props),
                params: calculateParams,
                onPreLoad: this.handlePreLoad,
                onAfterLoad: this.handleAfterLoad,
                onAbort: this.handleAbort,
                onSuccess: this.handleSuccess,
                onFailure: this.handleFailure,
                onFatal: this.handleFatal,
                ...options,
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

            if (!this.requestGroups[group]) {
                this.requestGroups[group] = [key];
            } else {
                this.requestGroups[group].push(key);
            }

            if (this.mounted) {
                this.requests[key].start();
            }
        }

        handlePreLoad = (key) => {
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

        handleRequestDone = (key) => {
            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.pending = false;

            // Calculate group state
            const { data: { group } } = this.requests[key];
            const groupState = group ? {
                [group]: {
                    pending: this.requestGroups[group]
                        .filter(k => k !== key)
                        .some(k => this.state[k].pending),
                },
            } : emptyObject;

            this.setState({ [key]: newState, ...groupState });
        }

        handleAfterLoad = (key) => {
            this.handleRequestDone(key);
        }

        handleAbort = (key) => {
            this.handleRequestDone(key);
        }

        handleSuccess = (key, body, status) => {
            const { onSuccess } = this.requests[key].data;
            const response = transformResponse(body);

            if (onSuccess) {
                onSuccess({ response, status });
            }

            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.response = response;
            newState.responseError = undefined;
            newState.responseStatus = status;
            this.setState({ [key]: newState });
        }

        handleFailure = (key, body, status) => {
            const { onFailure } = this.requests[key].data;
            const error = transformErrors(body);

            if (onFailure) {
                onFailure({ error, status });
            }

            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.response = undefined;
            newState.responseError = error;
            newState.responseStatus = status;
            this.setState({ [key]: newState });
        }

        handleFatal = (key, error) => {
            const { onFatal } = this.requests[key].data;
            if (onFatal) {
                onFatal({ error });
            }

            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.response = undefined;
            newState.responseError = error;
            newState.responseStatus = undefined;
            this.setState({ [key]: newState });
        }

        render() {
            const contextApi = {
                startRequest: this.startRequest,
                stopRequest: this.stopRequest,
                state: { ...this.state },
            };

            return (
                <RequestContext.Provider value={contextApi}>
                    <WrappedComponent {...transformProps(this.props)} />
                </RequestContext.Provider>
            );
        }
    }

    return hoistNonReactStatics(
        View,
        WrappedComponent,
    );
};

export default createRequestCoordinator();
