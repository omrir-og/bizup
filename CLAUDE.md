# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

No test runner is configured.

## Architecture

**BizUp** is a financial intelligence dashboard for SMB owners. It is a Next.js 16 (App Router) + React 19 + TypeScript app with Tailwind CSS v4 and Radix UI.

### Data layer — localStorage only
All persistence is handled client-side via `src/lib/store.ts`. There is no database or backend API other than the AI route. Keys: `bizup_businesses`, `bizup_transactions`, `bizup_lang`.

### State — React Context
`src/contexts/AppContext.tsx` is the single global store. It wraps the entire app (in `layout.tsx`) and exposes businesses, transactions, selected business, and language. All components consume it via `useApp()`.

### Routing
| Route | Purpose |
|---|---|
| `/` | Landing / business hub |
| `/dashboard/[businessId]` | Per-business financial dashboard |
| `/upload/[businessId]` | Bank file import wizard |
| `/insights/[businessId]` | AI-generated insights |
| `/api/ai` | Server-side Anthropic API proxy |

Pages that require a business context use `AppShell` (Sidebar + ChatWidget layout) and read `businessId` from the URL.

### AI integration
`src/app/api/ai/route.ts` proxies requests to `claude-sonnet-4-6` using `ANTHROPIC_API_KEY` from env. Supports a `voiceMode` flag for short audio-style summaries and responds in the user's chosen language (he/en).

### i18n
No i18n framework — translations live in `src/lib/translations.ts` as a plain `t.he` / `t.en` object. Language and text direction (`rtl`/`ltr`) are driven by `AppContext` and applied to `document.documentElement` in `AppShell`.

### File parsing
`src/lib/parser.ts` handles CSV (via papaparse) and Excel (via xlsx). It auto-detects header rows and columns using Hebrew + English keyword lists. Parsed transactions are saved to localStorage.

### Environment
`ANTHROPIC_API_KEY` must be set (e.g. in `.env.local`) for the AI chat and insights features to work.
