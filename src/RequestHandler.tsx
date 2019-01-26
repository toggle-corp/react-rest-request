import React from 'react';
import { ClientAttributes, NewProps, ExtendedContextState } from './declarations';
import { createRequestClient } from './RequestClient';

interface JustProps {
    url: string;
    method: string;
    query?: { [key: string]: string };
    body?: object;
    options?: object;
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
    constructor(props: ExtendedProps) {
        super(props);
        props.onRequestChange(props.requests.request, props.changeParams);
    }

    componentWillReceiveProps(nextProps: ExtendedProps) {
        if (this.props.requests.request !== nextProps.requests.request) {
            nextProps.onRequestChange(nextProps.requests.request, nextProps.changeParams);
        }
    }

    render() {
        return null;
    }
}

// tslint:disable-next-line variable-name
export const RequestHandler = createRequestClient(requests)(HandlerComponent);
