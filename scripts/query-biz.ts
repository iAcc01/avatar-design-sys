/**
 * query-biz.ts
 *
 * 查询业务组件（references/components/ 或 data/biz/registry.json）。
 *
 * 用法：
 *   npx tsx scripts/query-biz.ts <name1,name2,...>
 *
 * 业务组件目录约定：
 *   references/components/
 *     ├── README.md
 *     └── <ComponentName>/
 *         ├── README.md       (props/usage 文档)
 *         └── ...其他源码或示例
 *
 * 远程产物（CI 编译）：data/biz/registry.json + data/biz/{name}.md
 * 本脚本优先读远程；失败时直接从本地 references/components/ 列出。
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchText, fetchJson, LOCAL_REFERENCES } from './index.js';

interface BizItem {
  name: string;
  description?: string;
  path: string;
}

interface BizRegistry {
  count: number;
  items: BizItem[];
}

function listLocal(): BizItem[] {
  const dir = path.join(LOCAL_REFERENCES, 'components');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      const full = path.join(dir, name);
      return fs.statSync(full).isDirectory();
    })
    .map((name) => ({
      name,
      path: `references/components/${name}`,
    }));
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    // 无参：列出全部业务组件
    let items: BizItem[];
    try {
      const reg = await fetchJson<BizRegistry>('biz/registry.json');
      items = reg.items;
    } catch {
      items = listLocal();
    }
    console.log(`Available business components (${items.length}):`);
    for (const i of items) console.log(`  - ${i.name}${i.description ? `  — ${i.description}` : ''}`);
    return;
  }

  const names = arg.split(',').map((s) => s.trim()).filter(Boolean);

  for (const name of names) {
    // 优先远程
    try {
      const md = await fetchText(`biz/${name}.md`);
      console.log(md);
      console.log('---\n');
      continue;
    } catch {
      // 远程没有，回退本地 README
    }
    const local = path.join(LOCAL_REFERENCES, 'components', name, 'README.md');
    if (fs.existsSync(local)) {
      console.log(fs.readFileSync(local, 'utf-8'));
      console.log('---\n');
    } else {
      console.error(`[query-biz] not found: ${name}`);
    }
  }
}

main().catch((e) => {
  console.error(`[query-biz] error: ${e.message}`);
  process.exit(1);
});
