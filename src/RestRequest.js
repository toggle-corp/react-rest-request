// Utils

const isFalsy = val => (
    val === undefined || val === null || Number.isNaN(val) || val === false
);

const isTruthy = val => !isFalsy(val);

const noOp = () => {};

const createWarningFn = text => (response) => {
    console.warn(text);
    if (response) {
        console.log(response);
    }
};

export default class RestRequest {
    static POST = 'POST';
    static GET = 'GET';
    static PUT = 'PUT';
    static DELETE = 'DELETE';
    static PATCH = 'PATCH';

    static jsonHeaders = {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
    };

    /*
     * Parse url params and return an key-value pair
     * Input: stringParams (this.props.location.search.replace('?', ''))
     * Output: {'param': 'value', ....}
     */
    static parseUrlParams(stringParams) {
        const params = decodeURIComponent(stringParams).split('&');
        let paramsJson = {};
        params.forEach((param) => {
            const split = param.split('=');
            paramsJson = {
                ...paramsJson,
                [split[0]]: split[1],
            };
        });
        return paramsJson;
    }

    /*
     * Accept a key-value pair and transform to query string
     */
    static prepareUrlParams(params) {
        return Object.keys(params)
            .filter(k => isTruthy(params[k]))
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
    }

    constructor({
        key,
        url,
        params,

        onSuccess,
        onFailure,
        onFatal,
        onAbort,

        onPreLoad,
        onPostLoad,
        onAfterLoad,

        shouldRetry = true,
        retryTime = 1000,
        maxRetryAttempts = 5,

        pollTime,
        maxPollAttempts,
        shouldPoll,

        delay = 50,
    }) {
        this.key = key;
        this.url = url;
        this.params = params;
        this.delay = delay;

        this.success = onSuccess || createWarningFn('No success callback defined');
        this.failure = onFailure || createWarningFn('No failure callback defined');
        this.fatal = onFatal || createWarningFn('No fatal callback defined');
        this.abort = onAbort || createWarningFn('No abort callback defined');

        this.preLoad = onPreLoad || noOp;
        this.postLoad = onPostLoad || noOp;
        this.afterLoad = onAfterLoad || noOp;

        this.aborted = false;

        // Polling:

        this.pollTime = pollTime;
        this.maxPollAttempts = maxPollAttempts;
        this.shouldPoll = shouldPoll;

        this.pollId = null;
        this.pollCount = 1;

        // Retry:

        this.retryTime = retryTime;
        this.maxRetryAttempts = maxRetryAttempts;
        this.shouldRetry = shouldRetry;

        this.retryId = null;
        this.retryCount = 1;
    }

    start = () => {
        this.retryId = setTimeout(this.internalStart, this.delay);
    }

    internalStart = async () => {
        // Parameters can be a key-value pair or a function that returns a key-value pair
        this.parameters = typeof this.params === 'function' ? this.params(this.key) : this.params;
        this.urlValue = typeof this.url === 'function' ? this.url(this.key) : this.url;

        if (this.aborted) {
            this.abort(this.key);
            return;
        }

        this.preLoad(this.key);

        console.log(`Fetching ${this.urlValue}`, this.parameters);
        let response;
        try {
            response = await fetch(this.urlValue, this.parameters);
            if (this.aborted) {
                this.abort(this.key);
                return;
            }
        } catch (ex) {
            if (this.aborted) {
                this.abort(this.key);
                return;
            }

            // Most probably a network error has occured
            console.error(ex);
            const retrySuccessful = this.shouldRetry && this.retry();
            if (!retrySuccessful) {
                this.handleFatal({
                    errorMessage: ex.message,
                    errorCode: ex.statusCode,
                });
            }
            return;
        }

        let responseBody;
        try {
            responseBody = await response.text();
            if (this.aborted) {
                this.abort(this.key);
                return;
            }

            if (responseBody.length === 0) {
                responseBody = undefined;
            } else {
                responseBody = JSON.parse(responseBody);
            }
        } catch (ex) {
            if (this.aborted) {
                this.abort(this.key);
                return;
            }

            // Most probably a json parse error
            this.handleFatal({
                errorMessage: 'Error while parsing json',
                errorCode: null,
            });
        }

        console.log(`Recieving ${this.urlValue}`, responseBody);
        if (response.ok) {
            if (this.shouldPoll && this.shouldPoll(responseBody, response.status)) {
                this.poll();
            } else {
                this.handleSuccess(responseBody, response.status);
            }
            return;
        }

        const retrySuccessful = this.shouldRetry && this.retry();
        if (!retrySuccessful) {
            this.handleFailure(responseBody, response.status);
        }
    }

    stop = () => {
        clearTimeout(this.pollId);
        clearTimeout(this.retryId);

        this.pollCount = 1;
        this.retryCount = 1;
        this.aborted = true;
    }

    retry = () => {
        if (this.maxRetryAttempts >= 0 && this.retryCount > this.maxRetryAttempts) {
            console.warn(`Max no. of retries exceeded ${this.urlValue}`, this.parameters);
            return;
        }

        this.retryId = setTimeout(this.internalStart, this.retryTime);
        this.retryCount += 1;
    }

    poll = () => {
        if (this.pollCount > this.maxPollAttempts) {
            console.warn(`Max no. of polls exceeded ${this.urlValue}`, this.parameters);
            return;
        }

        this.pollId = setTimeout(this.internalStart, this.pollTime);
        this.pollCount += 1;
    }

    handleSuccess = (...attrs) => {
        this.postLoad(this.key);
        if (this.aborted) {
            this.abort(this.key);
            return;
        }

        this.success(this.key, ...attrs);
        if (this.aborted) {
            this.abort(this.key);
            return;
        }
        this.afterLoad(this.key);
    }


    handleFailure = (...attrs) => {
        this.postLoad(this.key);
        if (this.aborted) {
            this.abort(this.key);
            return;
        }

        this.failure(this.key, ...attrs);
        if (this.aborted) {
            this.abort(this.key);
            return;
        }
        this.afterLoad(this.key);
    }

    handleFatal = (...attrs) => {
        this.postLoad(this.key);
        if (this.aborted) {
            this.abort(this.key);
            return;
        }

        this.fatal(this.key, ...attrs);
        if (this.aborted) {
            this.abort(this.key);
            return;
        }
        this.afterLoad(this.key);
    }
}
