#!/usr/bin/env node
// Guards the bug class that silently broke GET /api/stores/availability: Express matches
// routes in registration order, so a single-segment `/:param` route registered before a
// literal sibling (`/availability`) swallows it and the literal handler never runs.
//
//   node tools/check-route-order.mjs        -> exits 1 and lists every shadowed route
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../packages/api/src', import.meta.url));
const CALL = /^\s*(?:export\s+const\s+)?(\w+)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.routes.ts') ? [full] : [];
  });
}

const problems = [];

for (const file of walk(ROOT)) {
  // key: `${routerVariable} ${httpMethod}` — only routes on the same router+verb can shadow
  const seenParamRoute = new Map();

  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    const match = CALL.exec(line);
    if (!match) return;

    const [, router, method, path] = match;
    const segments = path.split('/').filter(Boolean);
    if (segments.length !== 1) return; // multi-segment paths cannot collide with /:param

    const key = `${router} ${method}`;
    if (segments[0].startsWith(':')) {
      if (!seenParamRoute.has(key)) seenParamRoute.set(key, { path, line: index + 1 });
      return;
    }

    const shadow = seenParamRoute.get(key);
    if (shadow) {
      problems.push(
        `${file}:${index + 1}  ${method.toUpperCase()} ${path} is shadowed by ` +
          `${method.toUpperCase()} ${shadow.path} registered at line ${shadow.line}`,
      );
    }
  });
}

if (problems.length) {
  console.error(`Shadowed Express routes (${problems.length}):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('OK: no literal route is shadowed by an earlier /:param route.');
