# avatar-design-sys

D2C (Design-to-Code) skill for the **Avatar design system**, built on:

- **shadcn/ui** as the component foundation (zero-modification: design tokens align with shadcn defaults)
- **Lucide Icons** as the icon library
- **Custom tokens** (color / spacing / typography / radius) for visual identity

Converts Figma designs into maintainable React + Tailwind code.

---

## Architecture

```
┌─────────────────┐  edit       ┌──────────────┐  CI build   ┌─────────────┐
│  tokens/*.md    │ ──────────▶ │  build-data  │ ──────────▶ │   data/     │
│  semantic.json  │             │   .ts        │             │  (committed │
└─────────────────┘             └──────────────┘             │   to main)  │
                                                              └──────┬──────┘
                                                                     │ jsDelivr
                                                                     ▼
                                                          ┌──────────────────┐
                                                          │ skill consumers  │
                                                          │ (query-* scripts)│
                                                          └──────────────────┘
```

### Three-layer tokens

| Layer | Source | Output | Naming |
|-------|--------|--------|--------|
| Primitive | `tokens/color-palette.md` `spacing.md` `typography.md` `radius.md` | `data/tokens/primitives.json` | `--blue-7`, `--space-4`, `--text-base` |
| Semantic | `tokens/semantic.json` | `data/tokens/semantic.json` | `--background`, `--primary`, `--ring` (aligned with shadcn) |
| Utility | (compiled) | `data/tokens/tokens.css` | importable CSS file |

### Remote data delivery (zero-CDN cost)

- **Repo**: <https://github.com/iAcc01/avatar-design-sys>
- **Mirror**: `https://cdn.jsdelivr.net/gh/iAcc01/avatar-design-sys@main/data`
- **Version locking**: set `D2C_REF=v1.0.0` to pin to a git tag
- **Offline**: set `D2C_OFFLINE=1` to use local `data/` + `references/*.fallback.json`

---

## Directory layout

```
avatar-design-sys/
├── SKILL.md / PREFLIGHT_CHECK.md / RESULT_CHECK.md
├── tokens/                         # Single source of truth (human-edited)
│   ├── color-palette.md
│   ├── spacing.md
│   ├── typography.md
│   ├── radius.md
│   └── semantic.json
├── references/                     # Local fallback + business components
│   ├── components/                 # Business components (extend manually)
│   ├── shadcn.fallback.json
│   ├── lucide.fallback.json
│   └── tokens.fallback.json
├── data/                           # CI-built artifacts (consumed remotely)
│   ├── skill-version.json
│   ├── tokens/{primitives.json,semantic.json,tokens.css}
│   ├── shadcn/{registry.json,*.md}
│   ├── biz/{registry.json,*.md}
│   └── lucide/icons.json
├── scripts/
│   ├── index.ts                    # Shared: BASE_URL / fetchText / fetchJson
│   ├── build-data.ts               # tokens/ → data/tokens/
│   ├── sync-shadcn-registry.ts
│   ├── build-lucide-index.ts
│   ├── pull-tokens.ts              # remote → local fallback sync
│   ├── query-shadcn.ts
│   ├── query-biz.ts
│   ├── query-lucide.ts
│   ├── check-version.ts
│   ├── get-figma-context.ts
│   ├── analyze-components.ts
│   └── compare-images.ts
└── .github/workflows/build-data.yml
```

---

## Development

```bash
npm install                # install devDependencies (see "Install notes" below)
npm run build:data         # rebuild data/ from tokens/ (used by CI too)
npm run pull               # sync local fallback from remote
npm run check              # show local vs. remote skill-version
```

### Install notes

`@tdesign/d2c-utils` is hosted on **Tencent's internal npm registry** and is
required only by `scripts/get-figma-context.ts` and `scripts/compare-images.ts`
(the Figma → HTML and visual diff feedback flows). Public-network users:

- can still use `npm install` to install everything else (npm will warn that
  `@tdesign/d2c-utils` cannot be resolved — that's expected; remove it from
  `package.json` if your environment doesn't have access);
- can fully use `build:data`, `query-shadcn`, `query-biz`, `query-lucide`,
  `pull` and `check` scripts — none of these depend on `@tdesign/d2c-utils`.

For Tencent intranet users, configure the registry once:

```bash
npm config set @tdesign:registry <internal-registry-url>
```

### Releasing a new version

1. Edit files in `tokens/` (or business components in `references/components/`).
2. Push to `main` → GitHub Actions auto-rebuilds and commits `data/`.
3. Bump version in `data/skill-version.json` and `package.json`.
4. Tag and push:
   ```bash
   git tag v0.2.0
   git push origin main --tags
   ```
5. Consumers can pin to that tag via `D2C_REF=v0.2.0`.

---

## Consumer (project) integration

In the consumer React project:

```bash
# 1. Install shadcn + Tailwind + Lucide (one-time)
npx shadcn@latest init
npm i lucide-react

# 2. Import tokens.css (option A: remote)
# in app entry (e.g. main.tsx)
import "https://cdn.jsdelivr.net/gh/iAcc01/avatar-design-sys@main/data/tokens/tokens.css";

# 2'. (option B: copy locally)
curl -o src/styles/tokens.css \
  https://cdn.jsdelivr.net/gh/iAcc01/avatar-design-sys@main/data/tokens/tokens.css
```

`tailwind.config.ts` snippet (so Tailwind utilities consume our CSS variables):

```ts
export default {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... muted / accent / destructive / border / ring (shadcn defaults)
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
