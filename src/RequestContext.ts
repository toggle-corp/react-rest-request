import * as React from 'react';

import { Context } from './declarations';

const defaultState = {
    startRequest: () => {},
    stopRequest: () => {},
    state: {},
};

// tslint:disable-next-line variable-name
// eslint-disable-next-line import/prefer-default-export
export const RequestContext = React.createContext<Context>(
    defaultState,
);
