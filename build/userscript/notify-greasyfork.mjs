import { createHmac, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ASSET = 'ff14-glamour-zh.greasyfork.user.js';
export function isStableRelease(release) {
  return release?.draft === false && release.prerelease === false
    && /^v\d+\.\d+\.\d+$/.test(release.tag_name || '');
}

export async function notifyGreasyFork({ release, repository, url, secret, fetchImpl = fetch }) {
  // Greasy Fork uses the event's attachment, even with a latest/download sync URL.
  // Reject prereleases before reading credentials or making a webhook request.
  if (!isStableRelease(release)) return { skipped: true };
  if (!release.assets?.some(asset => asset.name === ASSET && asset.state === 'uploaded'))
    throw new Error('Stable release is missing the uploaded userscript asset');
  if (!url || !secret) throw new Error('Greasy Fork webhook secrets are not configured');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'api.greasyfork.org')
    throw new Error('Unexpected Greasy Fork webhook endpoint');
  const body = JSON.stringify({ action: 'published', release, repository, sender: repository.owner });
  const signature = algorithm => createHmac(algorithm, secret).update(body).digest('hex');
  const response = await fetchImpl(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(120000),
    headers: { 'content-type': 'application/json', 'x-github-event': 'release',
      'x-github-delivery': randomUUID(), 'x-hub-signature': 'sha1=' + signature('sha1'),
      'x-hub-signature-256': 'sha256=' + signature('sha256') }, body,
  });
  if (!response.ok) throw new Error(`Greasy Fork webhook returned HTTP ${response.status}`);
  const result = await response.json();
  if (!Array.isArray(result.updated_failed) || result.updated_failed.length
      || !Array.isArray(result.updated_scripts) || !result.updated_scripts.length)
    throw new Error('Greasy Fork did not confirm a successful script update');
  return { skipped: false, updated: result.updated_scripts.length };
}

async function main() {
  const tag = process.env.RELEASE_TAG;
  if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) {
    console.log('Greasy Fork: skipping non-stable release tag');
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Invalid repository');
  const github = async suffix => {
    const response = await fetch(`https://api.github.com/repos/${repo}${suffix}`, {
      headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`);
    return response.json();
  };
  const release = await github('/releases/tags/' + encodeURIComponent(tag));
  if (!isStableRelease(release)) { console.log('Greasy Fork: skipping draft or prerelease'); return; }
  // Dispatching a historical tag must not downgrade the distribution channel.
  const latest = await github('/releases/latest');
  if (latest.id !== release.id) throw new Error('Only the latest stable release may be synchronized');
  const repository = await github('');
  await notifyGreasyFork({ release, repository,
    url: process.env.GREASYFORK_WEBHOOK_URL?.trim(), secret: process.env.GREASYFORK_WEBHOOK_SECRET?.trim() });
  console.log('Greasy Fork: latest stable release synchronized successfully');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch {
    console.error('Greasy Fork notification failed. Check release metadata, webhook secrets and service availability.');
    process.exitCode = 1;
  }
}
