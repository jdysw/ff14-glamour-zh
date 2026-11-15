import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { notifyGreasyFork } from '../../build/userscript/notify-greasyfork.mjs';

const release = { id: 1, tag_name: 'v1.4.6', draft: false, prerelease: false,
  assets: [{ name: 'ff14-glamour-zh.greasyfork.user.js', state: 'uploaded' }] };
const repository = { full_name: 'example/repo', owner: { login: 'example' } };
let requests = 0;
const config = { release, repository, url: 'https://api.greasyfork.org/hooks/github/test', secret: 'test-secret',
  fetchImpl: async (_url, options) => {
    requests++;
    assert.equal(JSON.parse(options.body).action, 'published');
    assert.equal(JSON.parse(options.body).release.tag_name, 'v1.4.6');
    assert.equal(options.headers['x-github-event'], 'release');
    assert.equal(options.headers['x-hub-signature'], 'sha1=' + createHmac('sha1', 'test-secret').update(options.body).digest('hex'));
    return { ok: true, json: async () => ({ updated_scripts: ['script'], updated_failed: [] }) };
  } };
for (const changes of [
  { prerelease: true }, { draft: true }, { tag_name: 'v1.4.7-beta.1' },
  { tag_name: 'v1.4.7-rc.1', prerelease: false },
]) assert.deepEqual(await notifyGreasyFork({ ...config, release: { ...release, ...changes } }), { skipped: true });
assert.equal(requests, 0, 'beta/rc/draft releases must never contact Greasy Fork');
assert.deepEqual(await notifyGreasyFork(config), { skipped: false, updated: 1 });
assert.equal(requests, 1);
await assert.rejects(notifyGreasyFork({ ...config, release: { ...release, assets: [] } }), /missing/);
await assert.rejects(notifyGreasyFork({ ...config, fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
await assert.rejects(notifyGreasyFork({ ...config, fetchImpl: async () => ({ ok: true, json: async () => ({ updated_scripts: [], updated_failed: ['script'] }) }) }), /did not confirm/);
console.log('PASS stable-only Greasy Fork webhook: beta/rc/draft blocked, signed stable update, failures surfaced');
