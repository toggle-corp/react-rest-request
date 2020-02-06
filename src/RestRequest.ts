import AbortController from 'abort-controller';
import { isNotDefined, isDefined, resolve } from '@togglecorp/fujs';
import { UrlParams } from './declarations';

export enum methods {
    POST = 'POST',
    GET = 'GET',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH',
}

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

    // initial delay
    delay?: number;

    // retry
    shouldRetry?: boolean;
    retryTime?: number;
    maxRetryAttempts?: number;

    // polling
    shouldPoll?: PollFunc;
    pollTime?: number;
    maxPollAttempts?: number;

    // verbosity
    logWarning?: boolean;
    logInfo?: boolean;

    // lifecycle
    onInitialize?: TransformFunc<string, void>;
    onAbort?: TransformFunc<string, void>;
    onPreLoad?: TransformFunc<string, void>;
    onSuccess?: HandlerFunc;
    onFailure?: HandlerFunc;
    onFatal?: HandlerFunc;
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

    private onSuccess?: HandlerFunc;

    private onFailure?: HandlerFunc;

    private onFatal?: HandlerFunc;

    private onAbort?: TransformFunc<string, void>;

    private onPreLoad?: TransformFunc<string, void>;

    private onInitialize?: TransformFunc<string, void>;

    private onPostLoad?: TransformFunc<string, void>;

    private onAfterLoad?: TransformFunc<string, void>;

    private logWarning: boolean;

    private logInfo: boolean;

    private pollId?: number;

    private pollCount: number;

    private retryId?: number;

    private retryCount: number;

    private requestRunning: boolean;

    private requestAborted: boolean;

    private controller: AbortController;

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

        // Logging

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

        // Delay

        this.delay = delay;

        // Lifecycle

        this.onInitialize = onInitialize;
        this.onAbort = onAbort;
        this.onPreLoad = onPreLoad;
        this.onSuccess = onSuccess;
        this.onFailure = onFailure;
        this.onFatal = onFatal;
        this.onPostLoad = onPostLoad;
        this.onAfterLoad = onAfterLoad;

        // Internal variables

        this.pollCount = 1;
        this.retryCount = 1;
        this.requestRunning = false;
        this.requestAborted = false;

        this.controller = new AbortController();
    }

    public start = () => {
        if (this.requestAborted) {
            this.consoleWarn((urlValue, parameters) => [
                `Trying to start aborted request: ${urlValue}`, parameters
            ])
            return;
        }

        if (this.requestRunning) {
            this.consoleWarn((urlValue, parameters) => [
                `Trying to start running request: ${urlValue}`, parameters
            ])
            return;
        }

        this.setRunningStart();

        // NOTE: pre load should be called as request is sure to be called
        if (this.onInitialize) {
            this.onInitialize(this.key);
        }

        this.retryId = window.setTimeout(this.request, this.delay);
    }

    public stop = () => {
        // NOTE: Don't stop request that is not running
        // NOTE: even when RestRequest.stop is called request may still be running
        if (!this.requestRunning) {
            return;
        }

        clearTimeout(this.pollId);
        clearTimeout(this.retryId);

        this.requestAborted = true;
        this.controller.abort();

        this.consoleLog(() => {
            const urlValue = resolve(this.url, this.key);
            return [`Stopping: ${urlValue}`];
        })

        if (this.onAbort) {
            this.onAbort(this.key);
        }
    }

    private request = async () => {
        if (this.onPreLoad) {
            this.onPreLoad(this.key);
        }

        const urlValue = resolve(this.url, this.key);
        const parameters = resolve(this.params, this.key);

        this.consoleLog(() => [`Fetching: ${urlValue}`, parameters]);

        let response;
        try {
            const { signal } = this.controller;
            response = await fetch(urlValue, { ...parameters, signal });
            if (this.requestAborted) {
                this.setRunningComplete();
                return;
            }
        } catch (ex) {
            if (this.requestAborted) {
                this.setRunningComplete();
                return;
            }
            // Most probably a network error has occurred
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

        let responseBody: object = {};
        try {
            const responseText = await response.text();
            if (this.requestAborted) {
                this.setRunningComplete();
                return;
            }
            if (responseText.length > 0) {
                responseBody = JSON.parse(responseText);
            }
        } catch (ex) {
            if (this.requestAborted) {
                this.setRunningComplete();
                return;
            }
            // Most probably a error with json parse
            console.error(ex);
            // Most probably a json parse error
            this.handleFatal({
                errorMessage: 'Error while parsing json',
                errorCode: null,
            });
            return;
        }

        this.consoleLog(() => [`Receiving: ${urlValue}`, responseBody]);

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

    private retry = () => {
        if (this.maxRetryAttempts >= 0 && this.retryCount > this.maxRetryAttempts) {
            this.consoleWarn((urlValue, parameters) => [
                `Max retries exceeded: ${urlValue}`, parameters
            ]);
            return false;
        }

        this.retryId = window.setTimeout(this.request, this.retryTime);
        this.retryCount += 1;

        return true;
    }

    private poll = () => {
        if (this.maxPollAttempts && this.pollCount > this.maxPollAttempts) {
            this.consoleWarn((urlValue, parameters) => [
                `Max polls exceeded: ${urlValue}`, parameters
            ]);
            return;
        }

        this.pollCount += 1;
        this.pollId = window.setTimeout(this.request, this.pollTime);
    }

    private setRunningStart = () => {
        this.requestRunning = true;
    }

    private setRunningComplete = () => {
        this.requestRunning = false;
        this.requestAborted = false;
    }

    // utils

    private consoleLog = (method: () => any[]) => {
        if (this.logInfo) {
            console.log('RestRequest:', ...method());
        }
    }

    private consoleWarn = (method: (urlValue: string, parameters: unknown) => any[]) => {
        if (this.logWarning) {
            const urlValue = resolve(this.url, this.key);
            const parameters = resolve(this.params, this.key);
            console.warn('RestRequest:', ...method(urlValue, parameters));
        }
    }

    // handlers

    private handleSuccess = (responseBody: object, status: number = 0) => {
        if (this.onPostLoad) {
            this.onPostLoad(this.key);
        }

        if (this.onSuccess) {
            this.onSuccess(this.key, responseBody, status);
        } else {
            this.consoleWarn((urlValue, parameters) => [
                `No success callback defined: ${urlValue}`, parameters
            ]);
        }

        if (this.onAfterLoad) {
            this.onAfterLoad(this.key);
        }
        this.setRunningComplete();
    }

    private handleFailure = (responseBody: object, status: number = 0) => {
        if (this.onPostLoad) {
            this.onPostLoad(this.key);
        }

        if (this.onFailure) {
            this.onFailure(this.key, responseBody, status);
        } else {
            this.consoleWarn((urlValue, parameters) => [
                `No failure callback defined: ${urlValue}`, parameters
            ]);
        }

        if (this.onAfterLoad) {
            this.onAfterLoad(this.key);
        }
        this.setRunningComplete();
    }

    private handleFatal = (responseBody: object, status: number = 0) => {
        if (this.onPostLoad) {
            this.onPostLoad(this.key);
        }

        if (this.onFatal) {
            this.onFatal(this.key, responseBody, status);
        } else {
            this.consoleWarn((urlValue, parameters) => [
                `No fatal callback defined: ${urlValue}`, parameters
            ]);
        }

        if (this.onAfterLoad) {
            this.onAfterLoad(this.key);
        }
        this.setRunningComplete();
    }
}
