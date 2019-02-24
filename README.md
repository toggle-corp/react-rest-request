# React Rest Request
[![Install Size](https://packagephobia.now.sh/badge?p=@togglecorp/react-rest-request)](https://packagephobia.now.sh/result?p=@toggle-corp/react-rest-request@2.4.0) [![Build Status](https://travis-ci.com/toggle-corp/react-rest-request.svg?branch=develop)](https://travis-ci.com/toggle-corp/react-rest-request) [![Maintainability](https://api.codeclimate.com/v1/badges/6310581b1d6352b7dd4d/maintainability)](https://codeclimate.com/github/toggle-corp/react-rest-request/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/6310581b1d6352b7dd4d/test_coverage)](https://codeclimate.com/github/toggle-corp/react-rest-request/test_coverage) [![codecov](https://codecov.io/gh/toggle-corp/react-rest-request/branch/develop/graph/badge.svg)](https://codecov.io/gh/toggle-corp/react-rest-request) [![NPM Package](https://img.shields.io/npm/v/@togglecorp/react-rest-request.svg?style=flat-square)](https://www.npmjs.com/package/@togglecorp/react-rest-request)

[![Codecov](https://codecov.io/gh/toggle-corp/react-rest-request/branch/develop/graphs/tree.svg)](https://codecov.io/gh/toggle-corp/react-rest-request)

A powerful request library for react apps to coordinate requests in a page in an easy and flexible way.

## Installation

```
yarn add @togglecorp/react-rest-request
```

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

### Coordinator

Use the coordinator at some top level component so that you can create and use multiple request clients in any of its descendents.

```js
import { RequestCoordinator } from '#request';

@RequestCoordinator
class UserPage extends React.PureComponent {
    // ...
}
```

### Client

The client is used to make actual requests and access the response using props.

```js
import { RequestClient, requestMethods } from '#request';

const requests = {
    saveUserDetails: {
        method: requestMethods.PUT,
        url: ({ props }) => `/users/${props.userId}/`,
        body: ({ params: { userData } }) => userData,
    },
};

@RequestClient(requests)
class UserForm extends React.PureComponent {
    // ...

    handleSave = () => {
        this.props.saveUserDetails.do({
            userData: this.state.formData,
        });
    }

    render() {
        const { saveUserDetails } = this.props;

        const {
            pending,        // request is being made, useful to show loading animation
            response,       // response returned after the request was successful
            responseStatus, // status of response
            responseError,  // error when request fails
        } = saveUserDetails;

        // ...
    }
}
```

#### Requests settings

When using the `RequestClient` HOC, a `requests` object needs to be provided which contains details for each request using key, value settings.

Following is the syntax for this `requests` object.

```js
const requests = {
    [request_name]: {
        [key]: [value],
        // ...
    },
};
```

Here the `request_name` is a unique prop that the component will receive for handling the request and its response. For each such request, it is required to provide a number of key-value pair to define request settings such as its url, request method, body etc.

Each of these settings can either a have fixed value, for example:

```js
    url: '/api/users/',
```

Or, it can be a function of signature: `({ props, params }) => {}` which can return a dynamic value, for example:

```js
    url: ({ props }) => `/api/users/${props.userId}`,
```

Here `props` is the component's props and `params` is something that the user can provide when making the request.

Each request is now made available to the component using `request_name` prop. The `do` method of this request prop can be used to make the actual request. The `do` method can optionally take a `params` that can be accessed from the request settings above.

```js
    this.props.[request_name].do(params);
```

The same prop also contains other info such as the pending status, the response body and any error encountered when making the request, as shown in the example in previous section.

#### Callbacks

`onSuccess`, `onFailure` and `onFatal` are some callbacks that can be provided as the request settings.

```js
const requests = {
    userSaveRequest: {
        // ...
        onSuccess: ({ props, response }) => {
            props.setUserReduxAction(response);
        },
    },
};
```

#### Auto requests

Request can be triggered automatically when the component mounts:

```js
const requests = {
    userDetailsRequest: {
        // onMount can be a true/false value
        onMount: true,

        // or a function that returns true/false value based on some props
        onMount: ({ props }) => !props.userData,

        // ...
    },
};
```

Similarly a request can be retriggered everytime some prop changes:

```js
const requests = {
    userDetailsRequest: {
        // onPropsChanged can be a list of props. The request is
        // retriggered when any of these props change.
        onPropsChanged: ['userId', 'projectId'],

        // Or it can be a object where the keys are prop names
        // and values are either true/false value or function
        // that evaluates to true/false.
        // The request is retriggered when any of these props
        // change and each corresponding function evaluates to true.
        onPropsChanged: {
            userId: ({ props, prevProps }) => {
                // I seriously cannot think of an example where
                // the user needs both props and prevProps but
                // this function should return either true or false.
            },
            projectId: true,
        },
    },
}
```

Because, user cannot provide params when these requests are auto triggered,
a method `setDefaultParams` is provided. User can then set default params to use
when actual params is not provided when making the request.

```js
const requests = {
    userDetailsRequest: {
        // ...
        onMount: true,
        onSuccess: ({ response, params: { setUserProject } }) => {
            setUserProject(response.project);
        },
    },
};

@RequestClient(requests)
const TestComponent extends React.PureComponent {
    constructor(props) {
        super(props);

        // ...

        props.userDetailsRequest.setDefaultParams({
            setUserProject: (project) => {
                this.setState({ project });
            },
        });
    }

    // ...
}
```
