import {
    prepareUrlParams,
    parseUrlParams,
} from './RestRequest';

test('preapare url params', () => {
    expect(prepareUrlParams({})).toBe('');
    expect(prepareUrlParams({ name: 'hari', age: '12' })).toBe('name=hari&age=12');
    expect(prepareUrlParams({ name: 'hari' })).toBe('name=hari');
    expect(prepareUrlParams({ name: undefined })).toBe('');
    expect(prepareUrlParams({ age: null, name: 'hari' })).toBe('name=hari');
    expect(prepareUrlParams({ name: 'shyam sundar' })).toBe('name=shyam%20sundar');
    expect(prepareUrlParams({ name: 'hari', favorites: ['1', '2'] })).toBe('name=hari&favorites=1%2C2');
    expect(prepareUrlParams({ name: 'hari', favorites: [1, 2] })).toBe('name=hari&favorites=1%2C2');
});

test('preapare url params', () => {
    expect(parseUrlParams('')).toEqual({});
    expect(parseUrlParams('name=hari')).toEqual({ name: 'hari' });
    expect(parseUrlParams('name=hari&age=12')).toEqual({ name: 'hari', age: '12' });
    expect(parseUrlParams('name=shyam%20sundar')).toEqual({ name: 'shyam sundar' });
    expect(parseUrlParams('name=hari&favorites=1%2C2')).toEqual({ name: 'hari', favorites: '1,2' });
});
