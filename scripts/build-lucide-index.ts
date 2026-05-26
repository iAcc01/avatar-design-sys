/**
 * build-lucide-index.ts
 *
 * 从 npm 包 `lucide-static` 读取 icons.json/tags.json/categories.json，
 * 编译成统一的 data/lucide/icons.json 索引。
 *
 * 输出：
 *   data/lucide/icons.json
 *     {
 *       version: "0.x.x",
 *       count: number,
 *       icons: [
 *         { name: "lock", tags: ["security",...], categories: ["security"] }, ...
 *       ]
 *     }
 *   references/lucide.fallback.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { LOCAL_DATA, LOCAL_REFERENCES } from './index.js';

const require = createRequire(import.meta.url);

interface IconRecord {
  name: string;
  tags: string[];
  categories: string[];
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function tryResolveLucidePath(): string | null {
  try {
    const pkgJson = require.resolve('lucide-static/package.json');
    return path.dirname(pkgJson);
  } catch {
    return null;
  }
}

function main() {
  const lucideRoot = tryResolveLucidePath();
  if (!lucideRoot) {
    console.warn(`[build-lucide] lucide-static not installed. Run: npm i -D lucide-static`);
    console.warn(`[build-lucide] keeping existing data/lucide/ unchanged`);
    return;
  }

  // tags.json: { "lock": ["security", "password"], ... }
  const tagsPath = path.join(lucideRoot, 'tags.json');
  // categories.json: { "security": ["lock","unlock",...], ... }
  const categoriesPath = path.join(lucideRoot, 'categories.json');
  // package.json 取版本
  const pkg = JSON.parse(fs.readFileSync(path.join(lucideRoot, 'package.json'), 'utf-8'));

  if (!fs.existsSync(tagsPath)) {
    throw new Error(`[build-lucide] tags.json not found at ${tagsPath}`);
  }

  const tags: Record<string, string[]> = JSON.parse(fs.readFileSync(tagsPath, 'utf-8'));
  let categories: Record<string, string[]> = {};
  if (fs.existsSync(categoriesPath)) {
    categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
  }

  // 反向索引：icon -> categories
  const iconToCats: Record<string, string[]> = {};
  for (const [cat, names] of Object.entries(categories)) {
    for (const n of names) {
      if (!iconToCats[n]) iconToCats[n] = [];
      iconToCats[n].push(cat);
    }
  }

  const icons: IconRecord[] = Object.keys(tags)
    .sort()
    .map((name) => ({
      name,
      tags: tags[name] || [],
      categories: iconToCats[name] || [],
    }));

  const out = {
    version: pkg.version,
    count: icons.length,
    icons,
  };

  const outDir = path.join(LOCAL_DATA, 'lucide');
  ensureDir(outDir);
  ensureDir(LOCAL_REFERENCES);

  fs.writeFileSync(path.join(outDir, 'icons.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`[build-lucide] wrote data/lucide/icons.json (${icons.length} icons, lucide-static@${pkg.version})`);

  fs.writeFileSync(
    path.join(LOCAL_REFERENCES, 'lucide.fallback.json'),
    JSON.stringify(out, null, 2) + '\n'
  );
  console.log(`[build-lucide] wrote references/lucide.fallback.json`);
}

main();
