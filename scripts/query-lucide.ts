/**
 * query-lucide.ts
 *
 * 通过关键词模糊检索 Lucide 图标。
 *
 * 用法：
 *   npx tsx scripts/query-lucide.ts <kw1,kw2,...>
 *   npx tsx scripts/query-lucide.ts lock,user,password
 *
 * 输出：按相关度排序的图标名 + import 片段。
 */

import { fetchJson } from './index.js';

interface IconRecord {
  name: string;
  tags: string[];
  categories: string[];
}

interface IconsIndex {
  version: string;
  count: number;
  icons: IconRecord[];
}

/** 把 kebab-case 转 PascalCase（lucide-react import 名） */
function toPascal(name: string): string {
  return name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

interface ScoredIcon {
  icon: IconRecord;
  score: number;
  matchedBy: string[];
}

function scoreIcon(icon: IconRecord, kws: string[]): ScoredIcon | null {
  let score = 0;
  const matched: string[] = [];
  const lowerName = icon.name.toLowerCase();
  for (const kw of kws) {
    const k = kw.toLowerCase();
    // name 完全相等：最高分
    if (lowerName === k) {
      score += 10;
      matched.push(`name=${kw}`);
      continue;
    }
    // name 包含
    if (lowerName.includes(k)) {
      score += 5;
      matched.push(`name~${kw}`);
    }
    // tag 命中
    if (icon.tags.some((t) => t.toLowerCase() === k)) {
      score += 3;
      matched.push(`tag=${kw}`);
    } else if (icon.tags.some((t) => t.toLowerCase().includes(k))) {
      score += 1;
      matched.push(`tag~${kw}`);
    }
    // category 命中
    if (icon.categories.some((c) => c.toLowerCase() === k)) {
      score += 2;
      matched.push(`cat=${kw}`);
    }
  }
  return score > 0 ? { icon, score, matchedBy: matched } : null;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npx tsx scripts/query-lucide.ts <kw1,kw2,...>');
    console.error('Example: npx tsx scripts/query-lucide.ts lock,user');
    process.exit(1);
  }
  const kws = arg.split(',').map((s) => s.trim()).filter(Boolean);

  const index = await fetchJson<IconsIndex>('lucide/icons.json');

  const scored = index.icons
    .map((i) => scoreIcon(i, kws))
    .filter((x): x is ScoredIcon => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  if (scored.length === 0) {
    console.log(`No icons matched: ${kws.join(', ')}`);
    console.log(`Try broader keywords (e.g. "user,profile,account" or "arrow,chevron").`);
    return;
  }

  console.log(`# Top ${scored.length} matches (lucide-static@${index.version})\n`);
  for (const s of scored) {
    console.log(
      `- **${s.icon.name}**  (score=${s.score}, ${s.matchedBy.join(', ')})`
    );
    if (s.icon.tags.length) console.log(`    tags: ${s.icon.tags.slice(0, 8).join(', ')}`);
  }

  console.log(`\n## Import\n`);
  console.log('```tsx');
  console.log(
    `import { ${scored.slice(0, 5).map((s) => toPascal(s.icon.name)).join(', ')} } from "lucide-react";`
  );
  console.log('```');
}

main().catch((e) => {
  console.error(`[query-lucide] error: ${e.message}`);
  process.exit(1);
});
