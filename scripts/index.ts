/**
 * avatar-design-sys: 共享配置与远程数据访问抽象层
 *
 * 数据分发策略：
 *   - 远程产物：data/ 通过 GitHub Actions 自动编译，由 jsDelivr 镜像 GitHub 公开仓库
 *   - 本地产物：data/ 同时存在于仓库（CI commit 回 main），用作本地预览
 *   - 本地兜底：references/*.fallback.json，远程失败时使用
 *
 * 环境变量：
 *   - D2C_OFFLINE=1     完全离线，强制走本地 data/ → references/
 *   - D2C_REF=v1.0.0    锁定远程版本（默认 main）
 *   - D2C_VERBOSE=1     打印远程/本地切换日志
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- skill 元信息 ----
export const SKILL_NAME = 'avatar-design-sys';
export const SKILL_VERSION = '0.1.0';

// ---- 远程仓库配置 ----
const ORG = 'iAcc01';
const REPO = 'avatar-design-sys';
const REF = process.env.D2C_REF || 'main';

/** 远程数据基址：jsDelivr 镜像 GitHub 公开仓库的 data/ 目录 */
export const BASE_URL = `https://cdn.jsdelivr.net/gh/${ORG}/${REPO}@${REF}/data`;

/** GitHub 原始内容地址（jsDelivr 缓存失效时的备用通道） */
export const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${ORG}/${REPO}/${REF}/data`;

// ---- 本地路径配置 ----
export const SKILL_ROOT = path.resolve(__dirname, '..');
export const LOCAL_DATA = path.join(SKILL_ROOT, 'data');
export const LOCAL_REFERENCES = path.join(SKILL_ROOT, 'references');
export const LOCAL_TOKENS = path.join(SKILL_ROOT, 'tokens');

const VERBOSE = process.env.D2C_VERBOSE === '1';
const OFFLINE = process.env.D2C_OFFLINE === '1';

function log(msg: string) {
  if (VERBOSE) console.error(`[avatar-design-sys] ${msg}`);
}

/**
 * 读取本地数据：优先 data/，回退 references/<basename>.fallback.json
 */
function readLocal(relPath: string): string {
  const dataPath = path.join(LOCAL_DATA, relPath);
  if (fs.existsSync(dataPath)) {
    log(`local: ${dataPath}`);
    return fs.readFileSync(dataPath, 'utf-8');
  }
  // fallback：用扁平命名映射 e.g. tokens/primitives.json -> references/tokens.fallback.json
  const segments = relPath.split('/');
  const topLevel = segments[0]; // tokens / shadcn / lucide / biz
  const fallback = path.join(LOCAL_REFERENCES, `${topLevel}.fallback.json`);
  if (fs.existsSync(fallback)) {
    log(`fallback: ${fallback}`);
    return fs.readFileSync(fallback, 'utf-8');
  }
  throw new Error(
    `[avatar-design-sys] local data not found: ${relPath} (tried ${dataPath} and ${fallback})`
  );
}

/**
 * 远程优先 + 本地兜底的文本拉取
 */
export async function fetchText(relPath: string): Promise<string> {
  if (OFFLINE) return readLocal(relPath);

  const url = `${BASE_URL}/${relPath}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      log(`remote: ${url}`);
      return await res.text();
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    log(`remote failed (${(e as Error).message}), fallback local`);
    return readLocal(relPath);
  }
}

/** 拉取并解析 JSON */
export async function fetchJson<T = unknown>(relPath: string): Promise<T> {
  const text = await fetchText(relPath);
  return JSON.parse(text) as T;
}

/** 用于内部脚本：仅本地读取（如 build 链路里编译产物互相引用） */
export function readLocalText(relPath: string): string {
  return readLocal(relPath);
}

export function readLocalJson<T = unknown>(relPath: string): T {
  return JSON.parse(readLocal(relPath)) as T;
}
