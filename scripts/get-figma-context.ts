import { figma2Html, figma2Image } from '@tdesign/d2c-utils';
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import http from 'http'
import { execSync } from 'child_process'

// ESM 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 将路径转换为 POSIX 风格（用于 HTML/URL 中的路径）
 * Windows 下将反斜杠转换为正斜杠
 */
function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

/**
 * 将本地文件路径转换为 file:// URL
 * 兼容 Windows 和 Unix 系统
 */
function pathToFileURL(filePath: string): string {
  const absolutePath = path.resolve(filePath)
  // Windows 路径需要添加额外的斜杠，如 file:///C:/path/to/file
  // Unix 路径直接使用，如 file:///path/to/file
  if (process.platform === 'win32') {
    return `file:///${absolutePath.replace(/\\/g, '/')}`
  }
  return `file://${absolutePath}`
}

const token = process.argv[2]
const figmaUrl = process.argv[3]
const model = process.argv[4]


if (!token || !figmaUrl) {
  console.error('Usage: npx tsx get-figma-context.ts <figma-token> <figma-url> [model]')
  process.exit(1)
}

/**
 * 静默执行 shell 命令，失败返回空字符串
 */
function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}


function resolveRepoUrl(explicit: string | undefined, projectRoot: string) {
  if (explicit && explicit.trim()) return explicit.trim()
  const remote = safeExec(`git -C "${projectRoot}" remote get-url origin`)
  if (remote) return remote
  return ''
}

function resolveUserName() {
  if (process.platform === 'darwin') {
    const iOAUser = safeExec(
      'defaults read ~/Library/Preferences/com.tencent.iOA.plist lastLoginUserName'
    )
    if (iOAUser) return iOAUser
  }

  const gitUser = safeExec('git config user.name')
  if (gitUser) return gitUser

  return ''
}

/**
 * 从 Figma URL 中提取 node ID
 * @param url Figma URL
 * @returns 格式化后的 node ID（用于文件夹名）
 */
function extractNodeId(url: string): string {
  const nodeIdMatch = url.match(/node-id=([^&]+)/)
  if (!nodeIdMatch) {
    throw new Error('Invalid Figma URL: node ID is required')
  }
  // 解码并保留原始格式作为文件夹名（将 : 替换为 - 以适应文件系统）
  const nodeId = decodeURIComponent(nodeIdMatch[1]).replace(/:/g, '-')
  return nodeId
}

/**
 * 获取 skill 的 _design-context 目录路径
 */
function getDesignContextDir(): string {
  // 当前脚本位于 scripts 目录下，需要返回上一级到 skill 根目录
  const skillRoot = path.resolve(__dirname, '..')
  return path.join(skillRoot, '_design-context')
}

/**
 * 获取项目根目录
 */
function getProjectRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..')
}

/**
 * 从 HTML 中提取所有资源 URL
 * @param html HTML 内容
 * @returns 资源 URL 列表
 */
function extractResourceUrls(html: string): string[] {
  const urls: Set<string> = new Set()
  
  // 匹配 background:url('...') 或 background-image:url('...')
  const bgUrlRegex = /url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g
  let match
  while ((match = bgUrlRegex.exec(html)) !== null) {
    urls.add(match[1])
  }
  
  // 匹配 <img src="...">
  const imgSrcRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/g
  while ((match = imgSrcRegex.exec(html)) !== null) {
    urls.add(match[1])
  }
  
  return Array.from(urls)
}

/**
 * 从 URL 生成本地文件基本名（不含扩展名）
 * @param url 资源 URL
 * @param index 索引（用于避免重名）
 * @returns 本地文件基本名（不含扩展名）
 */
function generateLocalFileBaseName(url: string, index: number): string {
  // 从 URL 中提取 UUID 部分（Figma 资源通常包含 UUID）
  const uuidMatch = url.match(/([a-f0-9-]{36})/i)
  if (uuidMatch) {
    return uuidMatch[1]
  }
  
  // 尝试从 URL 路径提取文件名
  const urlParts = url.split('/')
  let fileName = urlParts[urlParts.length - 1]
  
  // 移除查询参数
  fileName = fileName.split('?')[0]
  
  // 移除扩展名
  fileName = fileName.replace(/\.[^.]+$/, '')
  
  // 如果文件名太长或不合法，使用索引命名
  if (!fileName || fileName.length > 50 || !/^[\w.-]+$/.test(fileName)) {
    return `asset_${index}`
  }
  
  return fileName
}

/**
 * 根据 Content-Type 获取文件扩展名
 */
function getExtensionFromContentType(contentType: string | undefined): string {
  if (!contentType) return '.png'
  
  const typeMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
  }
  
  // 提取 MIME 类型（去除 charset 等参数）
  const mimeType = contentType.split(';')[0].trim().toLowerCase()
  return typeMap[mimeType] || '.png'
}

/**
 * 下载文件并返回实际的文件扩展名
 * @param url 资源 URL
 * @param destPathWithoutExt 目标路径（不含扩展名）
 * @returns 实际保存的文件路径
 */
async function downloadFile(url: string, destPathWithoutExt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    const request = protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadFile(redirectUrl, destPathWithoutExt).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`))
        return
      }
      
      // 根据 Content-Type 确定正确的扩展名
      const contentType = response.headers['content-type']
      const extension = getExtensionFromContentType(contentType)
      const destPath = destPathWithoutExt + extension
      
      const fileStream = fs.createWriteStream(destPath)
      response.pipe(fileStream)
      
      fileStream.on('finish', () => {
        fileStream.close()
        resolve(destPath)
      })
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}) // 删除部分下载的文件
        reject(err)
      })
    })
    
    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error(`Download timeout: ${url}`))
    })
  })
}

/**
 * 下载所有资源并替换 HTML 中的 URL
 * @param html HTML 内容
 * @param assetsDir 资源保存目录
 * @param relativeAssetsPath 相对资源路径（用于 HTML 中引用）
 * @returns 替换后的 HTML
 */
async function downloadAndReplaceUrls(
  html: string,
  assetsDir: string,
  relativeAssetsPath: string
): Promise<{ html: string; downloadedFiles: string[] }> {
  const urls = extractResourceUrls(html)
  const urlToLocalPath: Map<string, string> = new Map()
  const downloadedFiles: string[] = []
  
  // 创建资源目录
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }
  
  // 下载所有资源
  console.error(`\n📦 Downloading ${urls.length} assets...`)
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const localFileBaseName = generateLocalFileBaseName(url, i)
    const localFilePathWithoutExt = path.join(assetsDir, localFileBaseName)
    
    try {
      // downloadFile 会根据 Content-Type 确定扩展名并返回完整路径
      const actualFilePath = await downloadFile(url, localFilePathWithoutExt)
      const actualFileName = path.basename(actualFilePath)
      // HTML 中的路径使用 POSIX 风格（正斜杠）
      const relativePath = `${relativeAssetsPath}/${actualFileName}`
      
      urlToLocalPath.set(url, relativePath)
      downloadedFiles.push(actualFileName)
      console.error(`   ✓ ${actualFileName}`)
    } catch (error) {
      console.error(`   ✗ Failed to download: ${url}`)
      // 下载失败时保留原 URL
    }
  }
  
  // 替换 HTML 中的 URL
  let processedHtml = html
  for (const [originalUrl, localPath] of urlToLocalPath) {
    // 转义正则特殊字符
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedUrl, 'g')
    processedHtml = processedHtml.replace(regex, localPath)
  }
  
  return { html: processedHtml, downloadedFiles }
}


async function main() {
  try {  
    // 提取 node ID
    const figmaNodeId = extractNodeId(figmaUrl)

    // 获取路径
    const projectRoot = getProjectRoot()
    const designContextDir = getDesignContextDir()
    const outputDir = path.join(designContextDir, figmaNodeId)
    const assetsDir = path.join(projectRoot, 'assets', figmaNodeId)

    const repoUrl = resolveRepoUrl(undefined, projectRoot)
    const userName = resolveUserName()

    // 获取 HTML
    console.log(`\n🎨 Fetching Design Resources...`)
    const extra = { repoUrl, userName, model }
    const html = await figma2Html(token, figmaUrl, {}, extra)

    // 计算相对路径（用于 HTML 中引用资源）
    // 从 outputDir 到 assetsDir 的相对路径，并转换为 POSIX 风格
    const relativeAssetsPath = toPosixPath(path.relative(outputDir, assetsDir))
    
    if (!fs.existsSync(designContextDir)) {
      fs.mkdirSync(designContextDir, { recursive: true })
      console.error(`📁 Created directory: ${designContextDir}`)
    }
    
    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    // 下载资源并替换 URL
    const { html: processedHtml, downloadedFiles } = await downloadAndReplaceUrls(
      html,
      assetsDir,
      relativeAssetsPath
    )
    
    // 生成完整的 HTML 文件（带有正确的编码声明，用于预览）
    // 预览文件使用文件的绝对路径，确保直接打开 HTML 文件时图片能正确加载（无需 HTTP 服务器）
    const absoluteAssetsPath = pathToFileURL(assetsDir)
    let htmlForPreview = processedHtml.replace(
      new RegExp(relativeAssetsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      absoluteAssetsPath
    )

    // 保存用于预览的完整 HTML 文件
    const previewHtmlFilePath = path.join(outputDir, 'figma.html')
    fs.writeFileSync(previewHtmlFilePath, htmlForPreview, 'utf-8')
    
    // 生成设计稿截图
    const imageUrl =  await figma2Image(token, figmaUrl, {
        tokenType: "personal",
    });
    const screenshotPath = path.join(outputDir, 'screenShot');
    await downloadFile(imageUrl, screenshotPath)
    console.log(`\n📷 Generate Design ScreenShot.png...`)

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
