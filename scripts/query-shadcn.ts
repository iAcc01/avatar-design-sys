/**
 * query-shadcn.ts
 *
 * 查询 shadcn 组件信息（远程优先 + 本地兜底）。
 *
 * 用法：
 *   npx tsx scripts/query-shadcn.ts <name1,name2,...>
 *   npx tsx scripts/query-shadcn.ts button,dialog,form
 *
 * 输出：每个组件一段 markdown（来自 data/shadcn/{name}.md），并附 install 命令汇总。
 */

import { fetchText, fetchJson } from './index.js';

interface RegistryItem {
  name: string;
  type: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; type?: string }>;
}

interface Registry {
  count: number;
  items: RegistryItem[];
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npx tsx scripts/query-shadcn.ts <name1,name2,...>');
    console.error('Example: npx tsx scripts/query-shadcn.ts button,dialog');
    process.exit(1);
  }

  const names = arg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 拿索引做存在性校验和模糊提示
  const registry = await fetchJson<Registry>('shadcn/registry.json');
  const known = new Set(registry.items.map((i) => i.name));

  const found: string[] = [];
  const missing: string[] = [];
  for (const n of names) {
    if (known.has(n)) found.push(n);
    else missing.push(n);
  }

  // 输出每个命中组件的 markdown
  for (const name of found) {
    const md = await fetchText(`shadcn/${name}.md`);
    console.log(md);
    console.log('---\n');
  }

  if (missing.length) {
    console.error(`\n[query-shadcn] not found: ${missing.join(', ')}`);
    // 给出最相近的候选（前缀/包含匹配）
    for (const m of missing) {
      const lower = m.toLowerCase();
      const hint = registry.items
        .map((i) => i.name)
        .filter((n) => n.toLowerCase().includes(lower) || lower.includes(n.toLowerCase()))
        .slice(0, 5);
      if (hint.length) console.error(`  ${m} -> maybe: ${hint.join(', ')}`);
    }
  }

  // 汇总 install 命令
  if (found.length) {
    console.log('## Install all\n');
    console.log('```bash');
    console.log(`npx shadcn@latest add ${found.join(' ')}`);
    console.log('```');
  }
}

main().catch((e) => {
  console.error(`[query-shadcn] error: ${e.message}`);
  process.exit(1);
});
