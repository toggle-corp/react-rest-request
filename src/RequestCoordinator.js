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

        startRequest = (requestData, ignoreIfExists) => {
            const {
                method,
                key,
                url,
                query,
                body,
            } = requestData;

            const oldRequest = this.requests[key];

            if (oldRequest && oldRequest.running) {
                if (ignoreIfExists) {
                    return;
                }
                oldRequest.stop();
            }

            const calculateParams = () => {
                const params = { headers: RestRequest.jsonHeaders };
                if (body) {
                    params.body = JSON.stringify(body);
                }
                return transformParams(params, this.props);
            };

            const preparedUrl = !query ? url : `${url}?${RestRequest.prepareUrlParams(query)}`;

            const request = new RestRequest({
                method,
                key,
                url: transformUrl(preparedUrl, this.props),
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
                    this.requests[key].running = true;
                    request.start();
                },
            };

            if (this.mounted) {
                this.requests[key].start();
            }
        }

        handlePreLoad = (key) => {
            const newState = { pending: true };
            this.setState({ [key]: newState });
        }

        handleAfterLoad = (key) => {
            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.pending = false;
            this.setState({ [key]: newState });
        }

        handleAbort = (key) => {
            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.pending = false;
            this.setState({ [key]: newState });
        }

        handleSuccess = (key, body, status) => {
            const { onSuccess } = this.requests[key].data;
            if (onSuccess) {
                onSuccess(transformResponse(body), status);
            }

            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.response = transformResponse(body);
            newState.responseStatus = status;
            this.setState({ [key]: newState });
        }

        handleFailure = (key, body, status) => {
            const { onFailure } = this.requests[key].data;
            if (onFailure) {
                onFailure(transformErrors(body), status);
            }

            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.responseError = transformErrors(body);
            newState.responseStatus = status;
            this.setState({ [key]: newState });
        }

        handleFatal = (key, error) => {
            const { onFatal } = this.requests[key].data;
            if (onFatal) {
                onFatal(error);
            }

            const requestState = this.state[key] || emptyObject;
            const newState = { ...requestState };
            newState.responseError = error;
            this.setState({ [key]: newState });
        }

        render() {
            const contextApi = {
                startRequest: this.startRequest,
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
