import React from 'react';
import { RestAttributes } from './RestRequest';
import { ClientAttributes, NewProps, ExtendedContextState } from './declarations';
import { createRequestClient } from './RequestClient';

interface JustProps {
    url: string;
    method: string;
    query?: { [key: string]: string | number | boolean | undefined };
    body?: object;
    options?: Partial<RestAttributes>;
    changeParams: unknown;
    onRequestChange(
        request: ExtendedContextState<undefined> | undefined,
        changeParams: unknown,
    ): void;
}
type ExtendedProps = NewProps<JustProps, undefined>;

const requests: { [key: string]: ClientAttributes<JustProps, undefined> } = {
    request: {
        onMount: true,
        onPropsChanged: ['url', 'query', 'body'],
        url: ({ props }) => props.url,
        body: ({ props }) => props.body,
        query: ({ props }) => props.query,
        method: ({ props }) => props.method,
    },
};

class HandlerComponent extends React.PureComponent<ExtendedProps> {
    public constructor(props: ExtendedProps) {
        super(props);
        props.onRequestChange(props.requests.request, props.changeParams);
    }

    public componentWillReceiveProps(nextProps: ExtendedProps) {
        const {
            requests: oldRequests,
        } = this.props;
        const {
            requests: newRequests,
            changeParams,
        } = nextProps;
        if (oldRequests.request !== newRequests.request) {
            nextProps.onRequestChange(newRequests.request, changeParams);
        }
    }

    public render() {
        return null;
    }
}

// tslint:disable-next-line variable-name
// eslint-disable-next-line import/prefer-default-export
export const RequestHandler = createRequestClient(requests)(HandlerComponent);
