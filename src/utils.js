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
