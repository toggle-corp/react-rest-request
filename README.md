# React Rest Request
[![Install Size](https://packagephobia.now.sh/badge?p=@togglecorp/react-rest-request)](https://packagephobia.now.sh/result?p=@toggle-corp/react-rest-request@2.5.0) [![Build Status](https://travis-ci.com/toggle-corp/react-rest-request.svg?branch=develop)](https://travis-ci.com/toggle-corp/react-rest-request) [![Maintainability](https://api.codeclimate.com/v1/badges/6310581b1d6352b7dd4d/maintainability)](https://codeclimate.com/github/toggle-corp/react-rest-request/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/6310581b1d6352b7dd4d/test_coverage)](https://codeclimate.com/github/toggle-corp/react-rest-request/test_coverage) [![codecov](https://codecov.io/gh/toggle-corp/react-rest-request/branch/develop/graph/badge.svg)](https://codecov.io/gh/toggle-corp/react-rest-request) [![NPM Package](https://img.shields.io/npm/v/@togglecorp/react-rest-request.svg?style=flat-square)](https://www.npmjs.com/package/@togglecorp/react-rest-request)

[![Codecov](https://codecov.io/gh/toggle-corp/react-rest-request/branch/develop/graphs/tree.svg)](https://codecov.io/gh/toggle-corp/react-rest-request)

A powerful request library for react apps to coordinate requests in a page in
an easy and flexible way.

## Installation

```
yarn add @togglecorp/react-rest-request
```

## Setting up

The core part of the library consists of two higher order components:
`RequestCoordinator` and `RequestClient`.

The coordinator is responsible for coordinating all requests in a page. The
clients are used to create individual requests in different components of the
page.

Before using this library in a project, it is first recommended to create the
actual HOCs using `createRequestCoordinator` and `createRequestClient` helper
functions.

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

    // Optional properties

    // Default handler for failure case
    onFailure: ({ error, status }) => {},
    // Default handler for fatal case
    onFatal: ({ error }) => {},
});
```

## Usage

### Request Coordinator

Use the coordinator at some top level component so that you can create and use
multiple request clients in any of its descendents.

```js
// UserPage.js
import { RequestCoordinator } from '#request';

@RequestCoordinator
class UserPage extends React.PureComponent {
}
```

### Request Client

The client is used to make actual requests and access the response using props.

```js
// UserForm.js
import { createRequestClient, methods } from '#request';

const requests = {
    saveUserDetails: {
        method: methods.PUT,
        url: ({ props }) => `/users/${props.userId}/`,
        body: ({ params: { userData } }) => userData,
    },
};

@createRequestClient(requests)
class UserForm extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            formData: {},
        };
    }

    handleSave = () => {
        const {
            requests: { saveUserDetails },
        } = this.props;
        const { formData } = this.state;

        saveUserDetails.do({
            userData: formData,
        });
    }

    render() {
        const {
            requests: {
                saveUserDetails,
            },
        } = this.props;

        const {
            pending,        // request is being made, useful to show loading animation
            response,       // response returned after the request was successful
            responseStatus, // status of response
            responseError,  // error when request fails
        } = saveUserDetails;

        return null;
    }
}
```

#### Writing requests

When using the `RequestClient` HOC, a `requests` object needs to be provided
which contains details for each request using key, value settings.

Following is the syntax for this `requests` object.

```js
const requests = {
    [request_name]: {
        [option_a]: [value],
        [option_b]: [value],
        // ...
    },
};
```

Here the `request_name` is a unique prop that the component will receive for
handling the request and its response. For each such request, it is required to
provide a number of key-value pair to define request settings such as its url,
request method, body etc.

Each of these settings can either a have fixed value, for example:

```js
    url: '/api/users/',
```

Or, it can be a function of signature: `({ props, params }) => {}` which can
return a value, for example:

```js
    url: ({ props }) => `/api/users/${props.userId}`,
```

Here `props` is the component's props and `params` is value that the user can
provide when making the request.

Each request is now made available to the component using `request_name` prop.
The `do` method of this request prop can be used to make the actual request.
The `do` method can optionally take a `params` that can be accessed from the
request settings above.

```js
    this.props.requests[request_name].do(params);
```

The same prop also contains other info such as the pending status, the response
body and any error encountered when making the request, as shown in the example
in previous section.

The list of options for a request are listed below:
1. method
2. url
3. query
4. body
5. options
6. onSuccess
7. onFailure
8. onFatal
9. onMount
10. onPropsChanged
11. isUnique
12. isPersistent
13. group
14. extras

Request can be triggered automatically when the component mounts using
`onMount` option:

```js
const requests = {
    userDetailsRequest: {
        // onMount can be a true/false value
        onMount: true,

        // or a function that returns true/false value based on some props
        onMount: ({ props }) => !props.userData,
    },
};
```

Similarly a request can be retriggered everytime some prop changes using
`onPropsChanged` option:

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

Because, user cannot provide params when these requests are auto-triggered, a
method `setDefaultParams` is provided. User can then set default params to use
when actual params is not provided when making the request.

```js
const requests = {
    userDetailsRequest: {
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

        props.requests.userDetailsRequest.setDefaultParams({
            setUserProject: (project) => {
                this.setState({ project });
            },
        });
    }
}
```

Request can be made unique inside a RequestCoordinator using `isUnique` option.

Request life can be bound to RequestCoordinator using `isPersistent` option.
By default, a request is aborted after the RequestClient is unmounted.

Request can be grouped using `group` option.

Some extra values can be passed to RequestCoordinator using `extras` option.
