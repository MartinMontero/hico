import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// HI CO deploys only as hico-preview and hico-prod. These four are live apps (CLAUDE.md).
export const FORBIDDEN_WORKER_NAMES = ['hico', 'mec-trails', 'lume', 'lume-city'];
export const ALLOWED_WORKER_NAMES = ['hico-preview', 'hico-prod'];

/** Removes // and block comments from JSONC without touching strings. */
export function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i] as string;
    const n = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += n ?? '';
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
    } else if (c === '"') {
      inString = true;
      out += c;
      i += 1;
    } else if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

interface WranglerLike {
  name?: string;
  env?: Record<string, { name?: string }>;
}

/** Every Worker name a configuration resolves to: the top level and each environment. */
export function resolvedNames(config: WranglerLike): string[] {
  const names: string[] = [];
  if (config.name) names.push(config.name);
  for (const env of Object.values(config.env ?? {})) if (env.name) names.push(env.name);
  return names;
}

export function checkNames(names: string[]): string[] {
  const problems: string[] = [];
  for (const name of names) {
    if (FORBIDDEN_WORKER_NAMES.includes(name)) problems.push(`Worker name "${name}" is a live app and must never be used`);
    else if (!ALLOWED_WORKER_NAMES.includes(name)) problems.push(`Worker name "${name}" is not hico-preview or hico-prod`);
  }
  return problems;
}

/** The source config plus any built config under dist/ (the plugin writes the resolved one there). */
export function collectConfigNames(root: string): { file: string; names: string[] }[] {
  const out: { file: string; names: string[] }[] = [];
  const src = join(root, 'wrangler.jsonc');
  out.push({ file: 'wrangler.jsonc', names: resolvedNames(JSON.parse(stripJsonc(readFileSync(src, 'utf8'))) as WranglerLike) });
  const dist = join(root, 'dist');
  if (existsSync(dist)) {
    for (const dir of readdirSync(dist, { withFileTypes: true })) {
      const file = join(dist, dir.name, 'wrangler.json');
      if (dir.isDirectory() && existsSync(file)) {
        out.push({ file: `dist/${dir.name}/wrangler.json`, names: resolvedNames(JSON.parse(readFileSync(file, 'utf8')) as WranglerLike) });
      }
    }
  }
  return out;
}
