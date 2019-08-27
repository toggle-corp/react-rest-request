import { Maybe, isNotDefined, isDefined, noOp, resolve } from '@togglecorp/fujs';

export enum methods {
    POST = 'POST',
    GET = 'GET',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH',
}

const createPlaceholderFn = (
    text: string,
    logInfo: boolean,
    logWarning: boolean,
) => (
    _: string,
    response?: object,
) => {
    if (logWarning) {
        console.warn(text);
    }
    if (response && logInfo) {
        console.log(response);
    }
};

/*
 * Parse url params and return an key-value pair
 * Input: stringParams (this.props.location.search.replace('?', ''))
 * Output: {'param': 'value', ....}
 */
export function parseUrlParams(stringParams: string) {
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
interface UrlParams {
    [key: string]: Maybe<string | number | boolean | (string | number | boolean)[]>;
}

export function prepareUrlParams(params: UrlParams) {
    return Object.keys(params)
        .filter(k => isDefined(params[k]))
        .map((k) => {
            const param = params[k];
            if (isNotDefined(param)) {
                return undefined;
            }
            let val: string;
            if (Array.isArray(param)) {
                val = param.join(',');
            } else if (typeof param === 'number' || typeof param === 'boolean') {
                val = String(param);
            } else {
                val = param;
            }
            return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
        })
        .filter(isDefined)
        .join('&');
}

interface TransformFunc<A, B>{
    (val: A): B;
}

interface PollFunc {
    (response: object, status: number): boolean;
}
export interface HandlerFunc {
    (key: string, response: object, status: number): void;
}

export interface RestAttributes {
    key: string;

    url: string | TransformFunc<string, string>;
    params: object | TransformFunc<string, object>;

    delay?: number;

    shouldRetry?: boolean;
    retryTime?: number;
    maxRetryAttempts?: number;

    shouldPoll?: PollFunc;
    pollTime?: number;
    maxPollAttempts?: number;

    logWarning?: boolean;
    logInfo?: boolean;
    onSuccess?: HandlerFunc;
    onFailure?: HandlerFunc;
    onFatal?: HandlerFunc;
    onAbort?: TransformFunc<string, void>;

    onInitialize?: TransformFunc<string, void>;
    onPreLoad?: TransformFunc<string, void>;
    onPostLoad?: TransformFunc<string, void>;
    onAfterLoad?: TransformFunc<string, void>;
}

export class RestRequest {
    private key: string;

    private url: string | TransformFunc<string, string>;

    private params: object | TransformFunc<string, object>;

    // initial delay before request is called
    private delay: number;

    private shouldRetry: boolean;

    private retryTime: number;

    private maxRetryAttempts: number;

    private shouldPoll?: PollFunc;

    private pollTime: number;

    private maxPollAttempts?: number;

    private success: HandlerFunc;

    private failure: HandlerFunc;

    private fatal: HandlerFunc;

    private abort: TransformFunc<string, void>;

    private preLoad: TransformFunc<string, void>;

    private initialize: TransformFunc<string, void>;

    private postLoad: TransformFunc<string, void>;

    private afterLoad: TransformFunc<string, void>;

    private logWarning: boolean;

    private logInfo: boolean;

    private pollId?: number;

    private pollCount: number = 1;

    private retryId?: number;

    private retryCount: number = 1;

    private aborted: boolean = false;

    private requestCompleted: boolean = false;

    public constructor({
        key,
        url,
        params,

        onSuccess,
        onFailure,
        onFatal,
        onAbort,

        onInitialize,
        onPreLoad,
        onPostLoad,
        onAfterLoad,

        shouldRetry = true,
        retryTime = 1000,
        maxRetryAttempts = 5,

        pollTime = 4000,
        maxPollAttempts,
        shouldPoll,

        delay = 50,
        logWarning = true,
        logInfo = true,
    }: RestAttributes) {
        this.key = key;
        this.url = url;
        this.params = params;
        this.delay = delay;

        this.success = onSuccess || createPlaceholderFn(
            'No success callback defined',
            logInfo,
            logWarning,
        );
        this.failure = onFailure || createPlaceholderFn(
            'No failure callback defined',
            logInfo,
            logWarning,
        );
        this.fatal = onFatal || createPlaceholderFn(
            'No fatal callback defined',
            logInfo,
            logWarning,
        );
        this.abort = onAbort || createPlaceholderFn(
            'No abort callback defined',
            logInfo,
            logWarning,
        );

        this.initialize = onInitialize || noOp;
        this.preLoad = onPreLoad || noOp;
        this.postLoad = onPostLoad || noOp;
        this.afterLoad = onAfterLoad || noOp;

        this.logWarning = logWarning;
        this.logInfo = logInfo;

        // Polling:

        this.pollTime = pollTime;
        this.maxPollAttempts = maxPollAttempts;
        this.shouldPoll = shouldPoll;

        // Retry:

        this.retryTime = retryTime;
        this.maxRetryAttempts = maxRetryAttempts;
        this.shouldRetry = shouldRetry;
    }

    public start = () => {
        // NOTE: pre load should be called as request is sure to be called
        this.initialize(this.key);

        this.retryId = window.setTimeout(this.internalStart, this.delay);
    }

    private internalStart = async () => {
        if (this.aborted) {
            return;
        }

        this.preLoad(this.key);

        const urlValue = resolve(this.url, this.key);
        const parameters = resolve(this.params, this.key);
        if (this.logInfo) {
            console.log(`Fetching ${urlValue}`, parameters);
        }

        let response;
        try {
            response = await fetch(urlValue, parameters);
            if (this.aborted) {
                return;
            }
        } catch (ex) {
            if (this.aborted) {
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
                return;
            }

            if (responseBody.length === 0) {
                responseBody = undefined;
            } else {
                responseBody = JSON.parse(responseBody);
            }
        } catch (ex) {
            if (this.aborted) {
                return;
            }

            // Most probably a json parse error
            this.handleFatal({
                errorMessage: 'Error while parsing json',
                errorCode: null,
            });
            return;
        }

        if (this.logInfo) {
            console.log(`Recieving ${urlValue}`, responseBody);
        }
        if (response.ok) {
            if (this.shouldPoll && this.shouldPoll(responseBody, response.status)) {
                this.poll();
            } else {
                this.handleSuccess(responseBody, response.status);
            }
            return;
        }

        const is5xxError = Math.floor(response.status / 100) === 5;
        if (!is5xxError) {
            this.handleFailure(responseBody, response.status);
            return;
        }

        // Only retry on 5xx errors
        const retrySuccessful = this.shouldRetry && this.retry();
        if (!retrySuccessful) {
            this.handleFailure(responseBody, response.status);
        }
    }

    public stop = () => {
        if (this.requestCompleted) {
            return;
        }

        const urlValue = resolve(this.url, this.key);

        if (urlValue && this.logInfo) {
            console.log(`Stopping ${urlValue}`);
        }

        clearTimeout(this.pollId);
        clearTimeout(this.retryId);

        this.pollCount = 1;
        this.retryCount = 1;
        this.aborted = true;

        this.abort(this.key);
    }

    private retry = () => {
        if (this.maxRetryAttempts >= 0 && this.retryCount > this.maxRetryAttempts) {
            if (this.logWarning) {
                const urlValue = resolve(this.url, this.key);
                const parameters = resolve(this.params, this.key);
                console.warn(`Max no. of retries exceeded ${urlValue}`, parameters);
            }
            return false;
        }

        this.retryId = window.setTimeout(this.internalStart, this.retryTime);
        this.retryCount += 1;

        return true;
    }

    private poll = () => {
        if (this.maxPollAttempts && this.pollCount > this.maxPollAttempts) {
            if (this.logWarning) {
                const urlValue: string = resolve(this.url, this.key);
                const parameters: object = resolve(this.params, this.key);
                console.warn(`Max no. of polls exceeded ${urlValue}`, parameters);
            }
            return;
        }

        this.pollId = window.setTimeout(this.internalStart, this.pollTime);
        this.pollCount += 1;
    }

    private handleSuccess = (responseBody: object, status: number = 0) => {
        if (this.aborted) {
            return;
        }

        this.requestCompleted = true;
        this.postLoad(this.key);
        this.success(this.key, responseBody, status);
        this.afterLoad(this.key);
    }

    private handleFailure = (responseBody: object, status: number = 0) => {
        if (this.aborted) {
            return;
        }

        this.requestCompleted = true;
        this.postLoad(this.key);
        this.failure(this.key, responseBody, status);
        this.afterLoad(this.key);
    }

    private handleFatal = (responseBody: object, status: number = 0) => {
        if (this.aborted) {
            return;
        }

        this.requestCompleted = true;
        this.postLoad(this.key);
        this.fatal(this.key, responseBody, status);
        this.afterLoad(this.key);
    }
}
