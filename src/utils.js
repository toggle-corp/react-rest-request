export const isFalsy = val => (
    val === undefined || val === null || Number.isNaN(val) || val === false
);

export const isTruthy = val => !isFalsy(val);

export const mapToList = (obj = {}, modifier) => (
    Object.keys(obj).reduce(
        (acc, key) => {
            const elem = obj[key];
            return [
                ...acc,
                modifier ? modifier(elem, key) : elem,
            ];
        },
        [],
    )
);

export const noOp = () => {};
export const identity = x => x;

export const resolve = (variable, ...args) => (
    typeof variable === 'function' ? variable(...args) : variable
);

export const randomString = (length = 8) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i += 1) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
