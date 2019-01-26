import React from 'react';

// TYPES

type NonOptionalKeys<T> = {
    [k in keyof T]-?: undefined extends T[k] ? never : k
}[keyof T];
type OptionalKeys<T> = {
    [k in keyof T]-?: undefined extends T[k] ? k : never
}[keyof T];

// COORDINATOR ATTRIBUTES

// should be able to have other values
export interface CoordinatorAttributes {
    key: string;
    group?: string;

    method: string;
    url: string;
    body?: object;
    query?: { [key: string]: string };
    options?: object;
    extras?: object;

    onSuccess?: (value: { response: object, status: number }) => void;
    onFailure?: (value: { error: object, status: number }) => void;
    onFatal?: (value: { error: object }) => void;
}

// COORDINATOR CONTEXT

export interface ContextState {
    pending?: boolean;
    response?: object;
    responseError?: object;
    responseStatus?: number;
}

export interface Context {
    startRequest(requestData: CoordinatorAttributes, ignoreIfExists?: boolean): void;
    stopRequest(key: string): void;
    state: { [key: string]: ContextState };
}

// CLIENT CONTEXT

export interface ExtensionState<Params> {
    pending?: boolean;
    setDefaultParams(params: Params): void;
    do?(params?: Params): void;
    abort?(): void;
}

export type ExtendedContextState<Params> = ExtensionState<Params> & ContextState;

// CLIENT ATTRIBUTES

export type NewProps<Props, Params> = {
} & {
    requests: { [key: string]: ExtendedContextState<Params> };
    setDefaultRequestParams: (params: Params) => void;
} & Props & { children?: React.ReactNode };

export interface InjectionFunction<Props, Params, T> {
    (args: { props: NewProps<Props, Params>, params?: Params }): T;
}
export interface InjectionFunctionWithPrev<Props, Params, T> {
    (args: { props: NewProps<Props, Params>, prevProps: Props, params?: Params }): T;
}
export interface InjectionFunctionForFunction<A, R, Props, Params> {
    (arg : (A & { props: NewProps<Props, Params>, params?: Params })): R;
}
type Resolve<P, Props, Params> = P extends (args: infer A) => infer R
    ? InjectionFunctionForFunction<A, R, Props, Params>
    : (P | InjectionFunction<Props, Params, P>);
type CoordinatorExtensionOptional<Props, Params> = {
    [key in Exclude<NonOptionalKeys<CoordinatorAttributes>, 'key'>]:
        Resolve<CoordinatorAttributes[key], Props, Params>;
};

type ResolveUncertain<P, Props, Params> = P extends (args: infer A) => infer R
    ? InjectionFunctionForFunction<A, R, Props, Params>
    : (P | InjectionFunction<Props, Params, P | undefined>);
type CoordinatorExtensionNonOptional<Props, Params> = {
    [key in Exclude<OptionalKeys<CoordinatorAttributes>, 'key'>]?:
        ResolveUncertain<Required<CoordinatorAttributes>[key], Props, Params>;
};
type OnlyClient<Props, Params> = {
    isUnique?: boolean;
    onPropsChanged?: (keyof Props)[] | {
        [key in keyof Props]: InjectionFunctionWithPrev<Props, Params, boolean>
    };
    onMount?: boolean | InjectionFunction<Props, Params, boolean>;
};
export type ClientAttributes<Props, Params> = (
    OnlyClient<Props, Params>
    & CoordinatorExtensionOptional<Props, Params>
    & CoordinatorExtensionNonOptional<Props, Params>
);
