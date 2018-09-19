import React from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';

import RequestContext from './RequestContext';

export default requestKeyList => (WrappedComponent) => {
    class RequestConsumer extends React.PureComponent {
        renderWrappedComponent = (contextApi) => {
            const props = requestKeyList.reduce((acc, key) => ({
                ...acc,
                [key]: contextApi[key],
                [`${key}Pending`]: contextApi[`${key}Pending`],
                [`${key}Error`]: contextApi[`${key}Error`],
            }), {});

            return (
                <WrappedComponent {...props} {...this.props} />
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
        RequestConsumer,
        WrappedComponent,
    );
};
