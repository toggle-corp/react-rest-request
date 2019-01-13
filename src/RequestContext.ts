import * as React from 'react';

import { Context } from './declarations';

const defaultState = {
    startRequest: () => {},
    stopRequest: () => {},
    state: {},
}

export const RequestContext = React.createContext<Context>(
    defaultState
);
