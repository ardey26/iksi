import { env } from 'cloudflare:workers';
import { linkKey, type LinkRecord } from '@iksi/core';
import { kvLinkStore } from './store';

const record: LinkRecord = {
	v: 1,
	id: 7,
	destination: 'https://example.com/a',
	flagged: false,
	permanent: true
};

const store = () => kvLinkStore(env.LINKS);

test('putFound then get returns the stored link', async () => {
	await store().putFound('iksi.app', 'found1', record, 1234);
	expect(await store().get('iksi.app', 'found1')).toEqual({
		kind: 'found',
		stored: { record, storedAt: 1234 }
	});
});

test('putMissing then get returns missing', async () => {
	await store().putMissing('iksi.app', 'gone1');
	expect(await store().get('iksi.app', 'gone1')).toEqual({ kind: 'missing' });
});

test('nothing stored reads as unknown', async () => {
	expect(await store().get('iksi.app', 'never')).toEqual({ kind: 'unknown' });
});

test('delete removes a found entry', async () => {
	await store().putFound('iksi.app', 'del1', record, 1);
	await store().delete('iksi.app', 'del1');
	expect(await store().get('iksi.app', 'del1')).toEqual({ kind: 'unknown' });
});

test('slugs are case-sensitive', async () => {
	const other = { ...record, id: 8 };
	await store().putFound('iksi.app', 'abc', record, 1);
	await store().putFound('iksi.app', 'ABC', other, 2);
	expect(await store().get('iksi.app', 'abc')).toMatchObject({ stored: { record } });
	expect(await store().get('iksi.app', 'ABC')).toMatchObject({ stored: { record: other } });
});

test('www and apex hosts share a key', async () => {
	await store().putFound('www.iksi.app', 'alias', record, 1);
	expect((await store().get('iksi.app', 'alias')).kind).toBe('found');
});

test.each([
	['not json', '{nope'],
	['wrong shape', JSON.stringify({ record: { v: 1 }, storedAt: 1 })],
	['bad storedAt', JSON.stringify({ record, storedAt: 'x' })],
	['json null', 'null']
])('corrupt value (%s) reads as unknown', async (_name, value) => {
	await env.LINKS.put(linkKey('iksi.app', 'corrupt'), value);
	expect(await store().get('iksi.app', 'corrupt')).toEqual({ kind: 'unknown' });
});
