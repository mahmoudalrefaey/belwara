# SpendHiST Frontend

Modern frontend for SpendHiST built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, and React Query.

## Stack

- Next.js 16 + React 19
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui (Base UI)
- TanStack Query v5
- Axios
- Recharts
- React Hook Form + Zod
- Sonner (toasts)
- Framer Motion
- next-themes

## Features

- JWT authentication (`spendhist_token`, `spendhist_user_id` in localStorage)
- Protected app routes with redirect to `/login`
- Dashboard analytics (client-side aggregation from receipts)
- Receipts management:
  - paginated list
  - debounced search
  - upload (multi-file image/PDF)
  - detail drawer + delete
- Chat assistant:
  - non-streaming response flow
  - persisted `thread_id` in localStorage
  - typing indicator while waiting
- Profile page:
  - user info
  - local preferences (`spendhist_prefs`) for default currency
  - theme switcher

## Project Structure

```text
src/
  app/
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (app)/layout.tsx
    (app)/dashboard/page.tsx
    (app)/receipts/page.tsx
    (app)/chat/page.tsx
    (app)/profile/page.tsx
    layout.tsx
    page.tsx
  components/
    chat/
    dashboard/
    layout/
    receipts/
    ui/
  hooks/
    useChat.ts
    useDashboard.ts
    useReceipts.ts
    useUser.ts
  lib/
    api.ts
    auth.ts
    format.ts
    prefs.ts
    utils.ts
  providers/
    AuthProvider.tsx
    QueryProvider.tsx
  types/
    api.ts
```

## Backend URL

The frontend reads backend base URL from:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Configured in `.env.local`.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create/update `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

3. Run development server:

```bash
npm run dev
```

4. Open:

- [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run ESLint

## API Contract Notes (Important)

- Auth login uses JSON body:
  - `POST /users/login` with `{ email, password }`
- Receipts list/search are paginated:
  - `{ items, total, limit, offset }`
- `POST /chat` is **not streaming**
  - frontend waits for full `{ reply, thread_id }`
- Axios timeout is set to 120s for slow chat/upload paths

## Local Storage Keys

- `spendhist_token`
- `spendhist_user_id`
- `spendhist_thread_id`
- `spendhist_chat_messages`
- `spendhist_prefs`

## Troubleshooting

- If login loops to `/login`:
  - check backend is running
  - verify token exists and is valid
- If API calls fail:
  - verify `NEXT_PUBLIC_API_URL`
  - check backend CORS settings
- If logo changes are not visible:
  - hard refresh (`Ctrl+Shift+R`)

