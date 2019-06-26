import { ClientAttributes } from './declarations';

interface Props {
    id: number,
    name: string,
    method: string,
    query?: { [key: string]: string | string[] | number },
    body?: object,
}

interface Params {
    test: boolean,
}

export const request: ClientAttributes<Props, Params> = {
    method: ({ props }) => props.name,
    url: '/deep/',
    onPropsChanged: ['id'],
    query: ({ props }) => {
        return props.query
    },
    body: ({ props }) => props.body,
    isUnique: false,
    onSuccess: ({ response, status }) => {
        console.warn(response, status);
    },
    onFailure: ({ error, params, status }) => {
        console.warn(error, params, status);
    },
    onFatal: ({ error, params }) => {
        console.warn(error, params);
    },
};
