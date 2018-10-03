# react-rest-request

A powerful request library for react apps to coordinate requests in a page in an easy and flexible way.

## Installation

TODO

## Setting up

The core part of the library consists of two higher order components: `RequestCoordinator` and `RequestClient`.

The coordinator is responsible for coordinating all requests in a page. The clients are used to create individual requests in different components of the page.

Before using this library in a project, it is first recommended to create the actual HOCs using `createRequestCoordinator` and `createRequestClient` helper functions.

```js
// request.js
import {
    createRequestCoordinator,
    createRequestClient,
    RestRequest,
} from '@togglecorp/react-rest-request';

export const RequestCoordinator = createRequestCoordinator({
    // You can optionally provide following transform functions:

    // props: actual props passed by this HOC to its child
    // params: request parameters containing header and body of the request
    // response: response when the request is successful
    // error: response when the request fails

    transformProps: props => props,
    transformParams: (params, props) => params,
    transformResponse: (response, props) => response,
    transformErrors: (errors, props) => errors,
});

export const RequestClient = createRequestClient();
export const requestMethods = RestRequest.methods;
```

## Usage

Use the `RequestCoordinator` HOC on a view level component. It will then bind all requests to the lifecycle of this component. For example, it will automatically destroy all requests (and their callbacks) when the component is unmounted. It can also act as a way of sharing requests between multiple components.

```js
import { RequestCoordinator } from '#request';

@RequestCoordinator
class UserEditPage extends React.PureComponent { ... }
```

Use the `RequestClient` HOC on all components that need to make requests. For `RequestClient` to work, there must be a `RequestCoordinator` either on the same component or one of the parent components. To define the requests themselves, pass an object describing the requests. Each request is then available through the component's props.

```js
import { RequestClient, requestMethods } from '#request';

const requestProps = {
    userGetRequest: {
        // onMount: the request is called when the
        // component is mounted.
        onMount: true,

        // onPropsChanged: the request is recalled when
        // one of the props changes.
        onPropsChanged: ['userId'],

        // Each of these properties can be a function or a value.
        // The function takes (props, params) as its arguments.
        // Where params is some custom paramters passed when making the request.
        method: requestMethods.GET,
        url: props => `/api/users/${props.userId}/`,
    },

    userSaveRequest: {
        method: requestMethods.POST,
        url: props => `/api/users/${props.userId}/`,
        body: (props, params) => params,
    },
};


@RequestClient(requestProps)
class UserForm extends React.PureComponent {
    /* ... */

    handleSave = () => {
        const { formData } = this.state;

        // Actual method to do the request is available through the prop:
        // `do{requestProp}` where the requestProp is capitalized.
        this.props.doUserSaveRequest(formData);
    }

    render() {
        const { userGetRequest } = this.props;
        const {
            // Use the following values as required
            pending,
            response,
            responseStatus,
            responseError,
        } = userGetRequest;
        /* ... */
    }
}
```

TODO: communicating requests across clients and request groups.
