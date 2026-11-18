// Copies the backend's OpenAPI documents into ../openapi and records the backend commit they come from.
//
//   node scripts/sync.ts <commit|branch>        from GitHub, at that commit (a branch is resolved to its commit)
//   node scripts/sync.ts --from <checkout>      from a local NetBoxPlus-Backend checkout, at its HEAD
//   node scripts/sync.ts --check                fails if ../openapi differs from GitHub at the recorded commit
//
// A local copy with uncommitted document changes is refused (--allow-dirty takes it anyway, for trying an API
// change before it is committed); it is then recorded as `<commit>+local`, which --check never accepts.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { services } from '../src/services.ts';

const repository = 'muratc34/NetBoxPlus-Backend';
const documentsPath = 'docs/openapi';
const openapiFolder = new URL('../openapi/', import.meta.url);
const headers = { 'User-Agent': 'netboxplus-api-sync', Accept: 'application/json' };

interface Source {
  readonly repository: string;
  readonly commit: string;
}

async function download(url: string): Promise<string> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GET ${url} answered ${String(response.status)}.`);
  }
  return response.text();
}

async function resolveCommit(ref: string): Promise<string> {
  if (/^[0-9a-f]{40}$/.test(ref)) {
    return ref;
  }
  const body = JSON.parse(
    await download(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`),
  ) as { sha?: unknown };
  if (typeof body.sha !== 'string') {
    throw new Error(`GitHub did not return a commit for "${ref}".`);
  }
  return body.sha;
}

function fromGitHub(commit: string): (name: string) => Promise<string> {
  return (name) =>
    download(`https://raw.githubusercontent.com/${repository}/${commit}/${documentsPath}/${name}.json`);
}

function git(checkout: string, ...args: string[]): string {
  return execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
}

async function write(read: (name: string) => Promise<string>, source: Source): Promise<void> {
  for (const service of services) {
    // Normalized to LF: the backend checkout may have CRLF on Windows, GitHub serves LF.
    const text = (await read(service.name)).replace(/\r\n/g, '\n');
    JSON.parse(text);
    await writeFile(new URL(`${service.name}.json`, openapiFolder), text);
  }
  await writeFile(new URL('source.json', openapiFolder), `${JSON.stringify(source, null, 2)}\n`);
  console.log(`Copied ${String(services.length)} documents from ${source.repository} at ${source.commit}.`);
}

async function check(): Promise<void> {
  const source = JSON.parse(await readFile(new URL('source.json', openapiFolder), 'utf8')) as Source;
  if (!/^[0-9a-f]{40}$/.test(source.commit)) {
    throw new Error(
      `openapi/source.json records "${source.commit}", not a pushed commit. Run the sync from GitHub.`,
    );
  }
  const read = fromGitHub(source.commit);
  const different: string[] = [];
  for (const service of services) {
    const local = await readFile(new URL(`${service.name}.json`, openapiFolder), 'utf8');
    if (local !== (await read(service.name)).replace(/\r\n/g, '\n')) {
      different.push(service.name);
    }
  }
  if (different.length > 0) {
    throw new Error(`openapi/ differs from ${repository} at ${source.commit}: ${different.join(', ')}.`);
  }
  console.log(`openapi/ matches ${repository} at ${source.commit}.`);
}

async function main(args: readonly string[]): Promise<void> {
  if (args[0] === '--check') {
    await check();
    return;
  }

  if (args[0] === '--from') {
    const checkout = path.resolve(args[1] ?? '');
    if (!args[1]) {
      throw new Error('--from needs the path of a NetBoxPlus-Backend checkout.');
    }
    const dirty = git(checkout, 'status', '--porcelain', '--', documentsPath) !== '';
    if (dirty && !args.includes('--allow-dirty')) {
      throw new Error(
        `${documentsPath} has uncommitted changes in ${checkout}. Commit them, or pass --allow-dirty.`,
      );
    }
    const commit = git(checkout, 'rev-parse', 'HEAD') + (dirty ? '+local' : '');
    await write((name) => readFile(path.join(checkout, documentsPath, `${name}.json`), 'utf8'), {
      repository,
      commit,
    });
    return;
  }

  const ref = args[0];
  if (!ref || ref.startsWith('-')) {
    throw new Error('Usage: sync.ts <commit|branch> | --from <checkout> [--allow-dirty] | --check');
  }
  const commit = await resolveCommit(ref);
  await write(fromGitHub(commit), { repository, commit });
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
