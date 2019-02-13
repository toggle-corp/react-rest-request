export type FirstArgument<T> = T extends (arg1: infer U, ...args: any[]) => any ? U : any;
export type Parameters<T> = T extends (... args: infer T) => any ? T : undefined[];
export type ReturnType<T> = T extends (... args: any[]) => infer R ? R : never;

export const isFalsy = (val: unknown | undefined): val is undefined => (
    val === undefined || val === null || val !== val
);
export const isTruthy = (val: unknown | undefined): val is {} => !isFalsy(val);

export function intersection<T>(a: T[], b: T[]) {
    const setB = new Set(b);
    return [...a].filter(x => setB.has(x));
}

export const noOp = () => {};

export function resolve<T>(variable: T, ...args: Parameters<T>) {
    if (typeof variable === 'function') {
        return variable(...args);
    }
    return variable;
}

export const randomString = (length: number = 8, mixedCase: boolean = false): string => {
    let text = '';
    const possible = mixedCase
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        : 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i += 1) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
