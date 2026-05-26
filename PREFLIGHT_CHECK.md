# Skill 版本和功能更新检测

- skill version: 0.1.0
- skill name: avatar-design-sys
- repository: https://github.com/iAcc01/avatar-design-sys

## 1. 检测 Skill 是否存在新版本

执行：

```bash
npx tsx scripts/check-version.ts
```

- 若提示 `up to date`，说明本地与远程一致。
- 若提示 `version mismatch`，运行 `npm run pull` 把远程 `data/` 同步到本地 `references/*.fallback.json`。

> 注：本 skill 的远程数据源为 jsDelivr 镜像 GitHub 公开仓库：
> `https://cdn.jsdelivr.net/gh/iAcc01/avatar-design-sys@main/data`
> 设置 `D2C_REF=v0.x.0` 可锁定到指定版本。

## 2. 预先安装 skill 自身依赖

```bash
npm install
```

skill 的 `devDependencies` 包含 `tsx`、`lucide-static`、`gray-matter`、`ts-morph`、`jimp`、`pixelmatch`。

## 3. 检测目标项目是否就绪（shadcn / Tailwind / lucide-react）

进入到将要写入代码的目标项目根目录，依次检查：

### 3.1 Tailwind CSS

```bash
# 必须存在 tailwind 配置
test -f tailwind.config.ts -o -f tailwind.config.js && echo "ok" || echo "missing"
```

如缺失：

```bash
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3.2 shadcn/ui

```bash
# 检查是否已 init shadcn（components.json 是 shadcn 项目入口）
test -f components.json && echo "ok" || echo "missing"
```

如缺失：

```bash
npx shadcn@latest init
```

按提示选择：style = `new-york`，color = `Neutral`，CSS variables = `Yes`（必须，否则无法消费我们的 tokens）。

### 3.3 lucide-react

```bash
node -e "require.resolve('lucide-react')" 2>/dev/null && echo "ok" || echo "missing"
```

如缺失：

```bash
npm i lucide-react
```

### 3.4 Token CSS 接入

将本 skill 的 `data/tokens/tokens.css` 引入目标项目（**二选一**）：

**方式 A（推荐：远程引入）** —— 在应用入口（如 `src/main.tsx`）顶部：

```ts
import "https://cdn.jsdelivr.net/gh/iAcc01/avatar-design-sys@main/data/tokens/tokens.css";
```

**方式 B（本地拷贝）**：

```bash
mkdir -p src/styles
curl -o src/styles/tokens.css \
  https://cdn.jsdelivr.net/gh/iAcc01/avatar-design-sys@main/data/tokens/tokens.css
# 然后在 src/index.css 顶部 @import
echo '@import "./styles/tokens.css";' | cat - src/index.css > /tmp/_ic && mv /tmp/_ic src/index.css
```

### 3.5 tailwind.config 桥接（让 Tailwind 工具类消费 CSS 变量）

确保 `tailwind.config.ts` 包含以下扩展（与 shadcn init 默认输出一致；若你已用 shadcn init 自动生成，则**无需重复添加**）：

```ts
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
```

> ⚠️ 我们的 `tokens.css` 中 `--background` 等使用 `var(--neutral-white)` 直接是 hex 值，所以 `hsl(var(--background))` 这一桥接其实可以简化为 `var(--background)`。如果你保留 shadcn init 默认配置（`hsl(var(...))`），需要在 `tokens/semantic.json` 中把值改为 HSL 三元组形式（`"primary": "210 95% 56%"`）。**当前 v0.1.0 默认使用直接颜色值方案**，请把 tailwind.config 中所有 `hsl(var(--xxx))` 改为 `var(--xxx)`，例如 `background: "var(--background)"`。

## 4. 配置 Figma Token

<!-- 将 Figma Token 配置在此处 https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens -->

- figma-token:

**如果 figma-token 为空，提示用户在此配置；参考 https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens**

## 5. Skill 运行信息

- model: 当前使用的模型
