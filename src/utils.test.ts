import { resolve } from './utils';


test('resolve', () => {
    expect(resolve((a: number, b: number) => a + b, 1, 2)).toBe(3);
    expect(resolve(1)).toBe(1);
    expect(resolve(false)).toBe(false);
    expect(resolve(undefined)).toBe(undefined);
    expect(resolve(0)).toBe(0);
    expect(resolve('hari')).toBe('hari');
});
