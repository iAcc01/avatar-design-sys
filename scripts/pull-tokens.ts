/**
 * pull-tokens.ts
 *
 * 把远程 data/ 的关键产物拉到本地 references/*.fallback.json，
 * 便于离线（D2C_OFFLINE=1）使用最新远程数据。
 *
 * 用法：
 *   npx tsx scripts/pull-tokens.ts
 *   D2C_REF=v0.2.0 npx tsx scripts/pull-tokens.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchJson, fetchText, LOCAL_REFERENCES } from './index.js';

async function main() {
  if (!fs.existsSync(LOCAL_REFERENCES)) fs.mkdirSync(LOCAL_REFERENCES, { recursive: true });

  // 1) tokens.fallback.json
  const primitives = await fetchJson('tokens/primitives.json');
  const semantic = await fetchJson('tokens/semantic.json');
  const tokensCss = await fetchText('tokens/tokens.css');
  fs.writeFileSync(
    path.join(LOCAL_REFERENCES, 'tokens.fallback.json'),
    JSON.stringify({ primitives, semantic, tokensCss }, null, 2) + '\n'
  );
  console.log('[pull] tokens.fallback.json updated');

  // 2) shadcn.fallback.json
  try {
    const shadcn = await fetchJson('shadcn/registry.json');
    fs.writeFileSync(
      path.join(LOCAL_REFERENCES, 'shadcn.fallback.json'),
      JSON.stringify(shadcn, null, 2) + '\n'
    );
    console.log('[pull] shadcn.fallback.json updated');
  } catch (e) {
    console.warn(`[pull] shadcn skip: ${(e as Error).message}`);
  }

  // 3) lucide.fallback.json
  try {
    const lucide = await fetchJson('lucide/icons.json');
    fs.writeFileSync(
      path.join(LOCAL_REFERENCES, 'lucide.fallback.json'),
      JSON.stringify(lucide, null, 2) + '\n'
    );
    console.log('[pull] lucide.fallback.json updated');
  } catch (e) {
    console.warn(`[pull] lucide skip: ${(e as Error).message}`);
  }

  console.log('[pull] done');
}

main().catch((e) => {
  console.error(`[pull] error: ${e.message}`);
  process.exit(1);
});
