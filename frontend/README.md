# بالورقة · Bel War’a — frontend

Next.js 16 (App Router) app for Bel War’a: a public landing page plus the signed-in app (dashboard, receipts, chat with Wara’a, account). Arabic is the default language (RTL); English is available at `/en`.

## Run

```bash
echo "NEXT_PUBLIC_API_URL=/api" > .env.local   # the browser calls /api/*, Next proxies it
npm install
npm run dev        # http://localhost:3000 → redirects to /ar or /en
npm run lint
npm run build
```

`next.config.ts` rewrites `/api/:path*` to `BACKEND_URL` (default `http://127.0.0.1:8000`), so one public URL serves both and no CORS setup is needed.

## Structure

```
messages/{ar,en}.json        all UI copy (Arabic is Egyptian colloquial)
src/i18n/                    next-intl routing (ar default), request config, locale-aware Link/router
src/proxy.ts                 locale detection and redirects (skips /api, /_next and files)
src/app/[locale]/
  page.tsx                   landing page (4-act scroll story)
  (auth)/                    login, register (split screen, the mascot reacts to the form)
  (app)/                     signed-in shell: dashboard, receipts, chat, profile
  not-found.tsx, error.tsx, opengraph-image.tsx
src/components/
  illustrations/             Wara’a the mascot (SVG, one component with poses) and scenes
  brand/                     logo mark and bilingual wordmark
  common/                    PageHeader, EmptyState, Stamp, Money/CountUp, Meter, Reveal, toggles
  landing/ dashboard/ receipts/ chat/ layout/ auth/ ui/
src/hooks/                   React Query hooks; useReceiptWatcher turns status changes into toasts
src/lib/                     api client, formatting, motion tokens, storage keys, plans
```

## Design system

- **Palette (Ink + Lime):** ink `#0A0A0B` and bone `#F4F4F0` surfaces, lime `#C6F432` as a fill with ink text on it. Lime is never used as text on light backgrounds; use `text-brand-text`. Semantic tokens live in `src/app/globals.css` (`positive`, `warning`, `destructive`, `chart-1…6`), with a full dark theme.
- **Type:** Readex Pro (headings), IBM Plex Sans Arabic (UI), IBM Plex Mono with tabular numbers for money (`.num`, `<Money>`).
- **Motifs:** torn receipt edge (`.edge-torn`), lime marker (`<Highlighter>`), dotted leaders (`.leader`), rubber-stamp statuses (`<Stamp>`).
- **Motion:** framer-motion only, shared tokens in `src/lib/motion.ts`. The landing page tells a story; the app animates only real events. `MotionConfig reducedMotion="user"` plus CSS fallbacks respect reduced motion.
- **RTL:** use logical classes (`ms-`, `pe-`, `start-`, `end-`, `text-start`). Mixed-script names use `dir="auto"` with `.bidi`.

## Honesty rules

- The app never shows invented numbers. Insights are computed from API data and labelled “calculated from your receipts”; AI output (chat, extracted fields) is labelled as AI.
- Extraction has no progress percentage, so the “reading” state is indeterminate. Only the upload itself shows real byte progress.
- Every number on the landing page is tagged “Example”.

## i18n notes

- Pass display numbers to `t()` as preformatted strings (`n`, `pct`, …). ICU would otherwise render Arabic-Indic digits, while money uses Latin digits (`ar-EG-u-nu-latn`). Plural selection still uses the numeric `count`.
- localStorage keys are `belwara_*`. Old `spendhist_*` keys are migrated once on first read (`src/lib/storage.ts`), so existing sessions survive the rename.
