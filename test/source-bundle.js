import { readFileSync } from 'node:fs';

/** Read an entry and its extracted controllers for static UI wiring assertions. */
export function readControllerBundle(entry) {
  const url = entry instanceof URL ? entry : new URL(entry, `file://${process.cwd()}/`);
  const source = readFileSync(url, 'utf8');
  const controllers = [...source.matchAll(/import\s+\{[^}]+\}\s+from\s+['"](\.\/(?:app-[^'"]+|[^'"]+-controller|tray-spawner-view|scene-entity-view)\.js)(?:\?[^'"]*)?['"]/g)];
  return [source, ...controllers.map(([, relative]) => readFileSync(new URL(relative, url), 'utf8'))].join('\n');
}
