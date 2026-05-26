import { Jimp } from "jimp";
import pixelmatch from "pixelmatch";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
// @ts-ignore
import { reportFeedback } from "@tdesign/d2c-utils";

type JimpImage = InstanceType<typeof Jimp>;

/**
 * 读取像素 RGBA
 */
function getRGBA(data: Buffer, x: number, y: number, width: number) {
  const idx = (y * width + x) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
}

/**
 * 判断一行/一列像素是否为"背景色"
 */
function isBackgroundLine(
  data: Buffer,
  width: number,
  height: number,
  axis: "row" | "col",
  index: number,
  bgColor: { r: number; g: number; b: number },
  tolerance = 8
): boolean {
  const len = axis === "row" ? width : height;
  let matched = 0;
  for (let i = 0; i < len; i++) {
    const x = axis === "row" ? i : index;
    const y = axis === "row" ? index : i;
    const p = getRGBA(data, x, y, width);
    if (
      Math.abs(p.r - bgColor.r) <= tolerance &&
      Math.abs(p.g - bgColor.g) <= tolerance &&
      Math.abs(p.b - bgColor.b) <= tolerance
    ) {
      matched++;
    }
  }
  return matched / len >= 0.95;
}

/**
 * 采样图片四角的主色作为背景色基准
 */
function detectBgColor(data: Buffer, width: number, height: number) {
  const corners = [
    getRGBA(data, 0, 0, width),
    getRGBA(data, width - 1, 0, width),
    getRGBA(data, 0, height - 1, width),
    getRGBA(data, width - 1, height - 1, width),
  ];
  // 取 RGB 均值
  const r = Math.round(corners.reduce((s, c) => s + c.r, 0) / 4);
  const g = Math.round(corners.reduce((s, c) => s + c.g, 0) / 4);
  const b = Math.round(corners.reduce((s, c) => s + c.b, 0) / 4);
  return { r, g, b };
}

/**
 * 自动裁剪：去掉图片四边的纯色 padding，只保留内容区
 * 这是解决"内容位置偏移导致双影"的关键步骤
 */
function autoTrim(image: JimpImage): {
  trimmed: boolean;
  bounds: { x: number; y: number; w: number; h: number };
} {
  const { width, height } = image;
  const data = image.bitmap.data;
  const bg = detectBgColor(data, width, height);

  let top = 0;
  while (top < height && isBackgroundLine(data, width, height, "row", top, bg))
    top++;
  let bottom = height - 1;
  while (
    bottom > top &&
    isBackgroundLine(data, width, height, "row", bottom, bg)
  )
    bottom--;
  let left = 0;
  while (left < width && isBackgroundLine(data, width, height, "col", left, bg))
    left++;
  let right = width - 1;
  while (
    right > left &&
    isBackgroundLine(data, width, height, "col", right, bg)
  )
    right--;

  const newW = right - left + 1;
  const newH = bottom - top + 1;

  if (newW <= 0 || newH <= 0 || (newW === width && newH === height)) {
    return { trimmed: false, bounds: { x: 0, y: 0, w: width, h: height } };
  }

  image.crop({ x: left, y: top, w: newW, h: newH });
  return { trimmed: true, bounds: { x: left, y: top, w: newW, h: newH } };
}

/**
 * 统一对比的图的尺寸与内容位置
 *
 * 步骤：
 * 1. autoTrim：各自裁掉纯色 padding，对齐内容起点
 * 2. 按较小宽度等比 downscale
 * 3. 按较小高度 letterbox（填充背景色）而不是 crop —— 保留完整内容
 */
async function normalizePair(
  image1: JimpImage,
  image2: JimpImage
): Promise<{ w: number; h: number; trim1: boolean; trim2: boolean }> {
  // 1) 先各自去除 padding 对齐内容
  const { trimmed: trim1 } = autoTrim(image1);
  const { trimmed: trim2 } = autoTrim(image2);

  // 2) 等比 downscale 到较小宽度
  const targetWidth = Math.min(image1.width, image2.width);
  if (image1.width !== targetWidth) image1.resize({ w: targetWidth });
  if (image2.width !== targetWidth) image2.resize({ w: targetWidth });

  // 3) 高度对齐：取较小高度，更大的图从顶部裁剪（内容已从顶部对齐）
  const targetHeight = Math.min(image1.height, image2.height);
  if (image1.height > targetHeight) {
    image1.crop({ x: 0, y: 0, w: targetWidth, h: targetHeight });
  }
  if (image2.height > targetHeight) {
    image2.crop({ x: 0, y: 0, w: targetWidth, h: targetHeight });
  }

  return { w: targetWidth, h: targetHeight, trim1, trim2 };
}

/**
 * 像素级相似度对比（pixelmatch）
 */
async function compareImages(
  imagePath1: string,
  imagePath2: string,
  outputDiffPath?: string
): Promise<{
  similarity: number;
  differencePixels: number;
  width: number;
  height: number;
  trim1: boolean;
  trim2: boolean;
}> {
  try {
    const [image1, image2] = await Promise.all([
      Jimp.read(imagePath1),
      Jimp.read(imagePath2),
    ]);

    const {
      w: width,
      h: height,
      trim1,
      trim2,
    } = await normalizePair(image1, image2);

    const img1Data = image1.bitmap.data;
    const img2Data = image2.bitmap.data;

    const diff = new Jimp({ width, height });
    const diffData = diff.bitmap.data;

    const numDiffPixels = pixelmatch(
      img1Data,
      img2Data,
      diffData,
      width,
      height,
      {
        threshold: 0.15,
        includeAA: true,
        alpha: 0.3,
        diffColor: [255, 0, 0],
        diffColorAlt: [0, 120, 255],
      }
    );

    const totalPixels = width * height;
    const similarity = ((totalPixels - numDiffPixels) / totalPixels) * 100;

    if (outputDiffPath) {
      diff.bitmap.data = diffData;
      await diff.write(outputDiffPath as `${string}.${string}`);
      console.log(`差异图片已保存到: ${outputDiffPath}`);
    }

    return {
      similarity: parseFloat(similarity.toFixed(2)),
      differencePixels: numDiffPixels,
      width,
      height,
      trim1,
      trim2,
    };
  } catch (error) {
    throw new Error(
      `图片对比失败: ${error instanceof Error ? error.message : error}`
    );
  }
}

/**
 * SSIM 对比
 */
async function compareImagesSSIM(
  imagePath1: string,
  imagePath2: string
): Promise<number> {
  const [image1, image2] = await Promise.all([
    Jimp.read(imagePath1),
    Jimp.read(imagePath2),
  ]);

  const { w: width, h: height } = await normalizePair(image1, image2);

  const d1 = image1.bitmap.data;
  const d2 = image2.bitmap.data;

  const BLOCK = 8;
  const C1 = 6.5025;
  const C2 = 58.5225;

  const blocksX = Math.floor(width / BLOCK);
  const blocksY = Math.floor(height / BLOCK);
  let totalSsim = 0;
  let blockCount = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0,
        sumY2 = 0;
      const pixels = BLOCK * BLOCK;

      for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) {
          const px = bx * BLOCK + x;
          const py = by * BLOCK + y;
          const idx = (py * width + px) * 4;
          const gx =
            d1[idx] * 0.299 + d1[idx + 1] * 0.587 + d1[idx + 2] * 0.114;
          const gy =
            d2[idx] * 0.299 + d2[idx + 1] * 0.587 + d2[idx + 2] * 0.114;
          sumX += gx;
          sumY += gy;
          sumXY += gx * gy;
          sumX2 += gx * gx;
          sumY2 += gy * gy;
        }
      }

      const meanX = sumX / pixels;
      const meanY = sumY / pixels;
      const varX = sumX2 / pixels - meanX * meanX;
      const varY = sumY2 / pixels - meanY * meanY;
      const covXY = sumXY / pixels - meanX * meanY;

      const ssim =
        ((2 * meanX * meanY + C1) * (2 * covXY + C2)) /
        ((meanX * meanX + meanY * meanY + C1) * (varX + varY + C2));

      totalSsim += ssim;
      blockCount++;
    }
  }

  const avgSsim = blockCount > 0 ? totalSsim / blockCount : 0;
  return parseFloat((avgSsim * 100).toFixed(2));
}

async function main() {
  const args = process.argv.slice(2);
  const [imagePath1, imagePath2, figmaLink, model] = args;

  if (!imagePath1 || !imagePath2) {
    console.error("错误: 缺少图片路径参数");
    console.error(
      "用法: npx tsx scripts/compare-images.ts <imagePath1> <imagePath2> <figmaLink> [model]"
    );
    process.exit(1);
  }

  if (!fs.existsSync(imagePath1)) {
    console.error(`错误: 找不到文件 ${imagePath1}`);
    process.exit(1);
  }
  if (!fs.existsSync(imagePath2)) {
    console.error(`错误: 找不到文件 ${imagePath2}`);
    process.exit(1);
  }

  const outputDiffPath = path.join(path.dirname(imagePath1), "diff.png");

  console.log("开始对比图片...");
  console.log(`图片1: ${imagePath1}`);
  console.log(`图片2: ${imagePath2}`);
  console.log(`差异图输出: ${outputDiffPath}`);
  console.log("");

  try {
    const [raw1, raw2] = await Promise.all([
      Jimp.read(imagePath1),
      Jimp.read(imagePath2),
    ]);
    console.log(
      `原始尺寸 - 图片1: ${raw1.width}x${raw1.height}，图片2: ${raw2.width}x${raw2.height}`
    );
    if (raw1.width !== raw2.width || raw1.height !== raw2.height) {
      console.log(
        "⚠️  检测到尺寸不一致，将自动裁剪 padding、按较小宽度等比缩放后再对比。"
      );
      const ratio1 = raw1.width / raw1.height;
      const ratio2 = raw2.width / raw2.height;
      if (Math.abs(ratio1 - ratio2) > 0.05) {
        console.log(
          `⚠️  两图宽高比差异较大（${ratio1.toFixed(2)} vs ${ratio2.toFixed(
            2
          )}），可能对比失真。建议：\n` +
            `    - 使用相同的视口宽度截图（推荐 1440）\n` +
            `    - Playwright 截图时设置 deviceScaleFactor: 1\n` +
            `    - 仅截取对应区域元素（page.locator('...').screenshot()）`
        );
      }
    }
    console.log("");

    const pixelResult = await compareImages(
      imagePath1,
      imagePath2,
      outputDiffPath
    );
    if (pixelResult.trim1 || pixelResult.trim2) {
      console.log(
        `已自动裁剪 padding: 图片1=${pixelResult.trim1 ? "是" : "否"}，图片2=${
          pixelResult.trim2 ? "是" : "否"
        }`
      );
    }
    console.log(`统一尺寸: ${pixelResult.width}x${pixelResult.height}`);
    console.log(
      `像素相似度: ${pixelResult.similarity}%  (差异像素: ${pixelResult.differencePixels})`
    );

    const ssimResult = await compareImagesSSIM(imagePath1, imagePath2);
    console.log(`SSIM 相似度: ${ssimResult}%`);

    // 可调整加权系数
    const PIXEL_WEIGHT = 0.7;
    const SSIM_WEIGHT = 0.3;
    const weighted =
      pixelResult.similarity * PIXEL_WEIGHT + ssimResult * SSIM_WEIGHT;
    console.log("=== 综合评价 ===");
    console.log(
      `加权相似度: ${weighted.toFixed(2)}%  (像素 ${
        PIXEL_WEIGHT * 100
      }% + SSIM ${SSIM_WEIGHT * 100}%)`
    );

    if (figmaLink) {
      function safeExec(cmd: string): string {
        try {
          return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .trim();
        } catch {
          return "";
        }
      }

      function resolveUserName() {
        if (process.platform === "darwin") {
          const iOAUser = safeExec(
            "defaults read ~/Library/Preferences/com.tencent.iOA.plist lastLoginUserName"
          );
          if (iOAUser) return iOAUser;
        }

        const gitUser = safeExec("git config user.name");
        if (gitUser) return gitUser;

        return "";
      }
      const userName = resolveUserName();
      const feedback = {
        pixelSimilarity: pixelResult.similarity,
        ssimSimilarity: ssimResult,
        avgSimilarity: parseFloat(weighted.toFixed(2)),
        model: model ?? "",
        userName,
      };
      try {
        reportFeedback(figmaLink, feedback);
      } catch {
        // 静默处理上报异常
      }
    }
  } catch (error) {
    console.error("错误:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { compareImages, compareImagesSSIM };
