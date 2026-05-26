/**
 * sync-shadcn-registry.ts
 *
 * 抓取 shadcn/ui 官方组件 → data/shadcn/registry.json + 单组件 markdown
 *
 * 数据源：
 *   - 单组件：https://ui.shadcn.com/r/styles/{style}/{name}.json
 *   - 组件清单：见下方 SHADCN_UI_COMPONENTS 常量（手工维护，覆盖官方所有 ui 组件）
 *
 * 输出：
 *   data/shadcn/registry.json     —— 精简索引（name/type/dependencies/registryDependencies/files）
 *   data/shadcn/{name}.md         —— 每个组件一份 Markdown
 *   references/shadcn.fallback.json —— 离线兜底
 *
 * 失败降级：单组件 404 时跳过；全部失败时保留已有产物。
 */

import * as fs from 'fs';
import * as path from 'path';
import { LOCAL_DATA, LOCAL_REFERENCES } from './index.js';

const STYLE = process.env.SHADCN_STYLE || 'new-york';
const COMPONENT_BASE_URL = `https://ui.shadcn.com/r/styles/${STYLE}`;

/** 官方 ui 组件名单（截至 shadcn/ui 2024 Q4，按字母序） */
const SHADCN_UI_COMPONENTS = [
  'accordion', 'alert', 'alert-dialog', 'aspect-ratio', 'avatar',
  'badge', 'breadcrumb', 'button', 'calendar', 'card',
  'carousel', 'chart', 'checkbox', 'collapsible', 'command',
  'context-menu', 'dialog', 'drawer', 'dropdown-menu', 'form',
  'hover-card', 'input', 'input-otp', 'label', 'menubar',
  'navigation-menu', 'pagination', 'popover', 'progress', 'radio-group',
  'resizable', 'scroll-area', 'select', 'separator', 'sheet',
  'sidebar', 'skeleton', 'slider', 'sonner', 'switch',
  'table', 'tabs', 'textarea', 'toggle', 'toggle-group',
  'tooltip',
];

interface RegistryItem {
  name: string;
  type: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; type?: string; target?: string }>;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'avatar-design-sys/0.1' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function emitMarkdown(item: RegistryItem): string {
  const deps = (item.dependencies || []).join(', ') || '—';
  const regDeps = (item.registryDependencies || []).join(', ') || '—';
  const files = (item.files || []).map((f) => `- \`${f.path}\``).join('\n') || '—';
  return [
    `# shadcn/${item.name}`,
    ``,
    `**Type**: \`${item.type}\``,
    ``,
    item.description ? `${item.description}` : `_(No description provided.)_`,
    ``,
    `## Install`,
    ``,
    '```bash',
    `npx shadcn@latest add ${item.name}`,
    '```',
    ``,
    `## Dependencies`,
    ``,
    `- npm: ${deps}`,
    `- registry: ${regDeps}`,
    ``,
    `## Files`,
    ``,
    files,
    ``,
  ].join('\n');
}

async function main() {
  const outDir = path.join(LOCAL_DATA, 'shadcn');
  ensureDir(outDir);
  ensureDir(LOCAL_REFERENCES);

  console.log(`[sync-shadcn] style=${STYLE}, components=${SHADCN_UI_COMPONENTS.length}`);

  const registry: RegistryItem[] = [];
  const skipped: string[] = [];

  // 适度并发（每批 6 个）以缩短时间，又不过度并发触发限流
  const BATCH = 6;
  for (let i = 0; i < SHADCN_UI_COMPONENTS.length; i += BATCH) {
    const batch = SHADCN_UI_COMPONENTS.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (name) => {
        try {
          const detail = await fetchJson<RegistryItem>(`${COMPONENT_BASE_URL}/${name}.json`);
          const slim: RegistryItem = {
            name: detail.name || name,
            type: detail.type || 'registry:ui',
            description: detail.description,
            dependencies: detail.dependencies,
            registryDependencies: detail.registryDependencies,
            files: (detail.files || []).map((f) => ({
              path: f.path,
              type: f.type,
              target: f.target,
            })),
          };
          fs.writeFileSync(path.join(outDir, `${slim.name}.md`), emitMarkdown(slim));
          return { ok: true as const, slim };
        } catch (e) {
          return { ok: false as const, name, err: (e as Error).message };
        }
      })
    );
    for (const r of results) {
      if (r.ok) registry.push(r.slim);
      else {
        skipped.push(r.name);
        console.warn(`[sync-shadcn] skip ${r.name}: ${r.err}`);
      }
    }
  }

  if (registry.length === 0) {
    console.warn(`[sync-shadcn] no components fetched, keeping existing data/shadcn/ unchanged`);
    return;
  }

  registry.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(
    path.join(outDir, 'registry.json'),
    JSON.stringify({ count: registry.length, items: registry }, null, 2) + '\n'
  );
  console.log(`[sync-shadcn] wrote data/shadcn/registry.json (${registry.length} items)`);

  fs.writeFileSync(
    path.join(LOCAL_REFERENCES, 'shadcn.fallback.json'),
    JSON.stringify({ count: registry.length, items: registry }, null, 2) + '\n'
  );
  console.log(`[sync-shadcn] wrote references/shadcn.fallback.json`);
  console.log(`[sync-shadcn] done (ok=${registry.length}, skipped=${skipped.length})`);
}

main().catch((e) => {
  console.error(`[sync-shadcn] fatal: ${e.message}`);
  process.exit(1);
});
