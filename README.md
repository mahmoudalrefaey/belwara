# SpendHiST

SpendHiST is an AI-powered receipt management and spending analytics platform with:

- **FastAPI backend** (OCR, parsing, PostgreSQL storage, JWT auth, LangGraph chat)
- **Next.js frontend** (dashboard, receipts, chat, profile, auth)

It supports multi-user receipt ingestion (images/PDF), searchable receipt history, and conversational spending insights.

> **Project Status:** This repository is currently in the **production hardening stage**.  
> The current public setup should be treated as a **demo / evaluation build** for anyone who wants to try the system.

---

## Table of Contents

- [Architecture](#architecture)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [Backend Setup and Run](#backend-setup-and-run)
- [Frontend Setup and Run](#frontend-setup-and-run)
- [API Overview](#api-overview)
- [Authentication Flow](#authentication-flow)
- [Chat Pipeline](#chat-pipeline)
- [Performance and Timeout Notes](#performance-and-timeout-notes)
- [Troubleshooting](#troubleshooting)
- [Production Recommendations](#production-recommendations)

---

## Architecture

### Backend (FastAPI)

1. User uploads receipt files (`/receipts/upload`)
2. OCR extracts raw text
3. Parser extracts structured fields (merchant, date, totals, items, currency)
4. Data is stored in PostgreSQL (`receipt`, `receipt_items`)
5. Chat endpoint (`/chat`) runs through LangGraph supervisor:
  - routes tasks to SQL agent when DB lookup is needed
  - routes to analyst agent for structured analysis
  - returns a final natural-language answer

### LLM Provider Base URL

All backend LLM calls use a **G0I OpenAI-compatible gateway**:

- **Base URL:** `https://g0i.shop/v1`
- Used by parser and agent models (`PARSER_MODEL`, `SQL_MODEL`, `AGENTIC_MODEL`)
- Authenticated with `G0I_API_KEY`

### Frontend (Next.js App Router)

- Protected application routes
- React Query data fetching and caching
- Receipts list/search/upload/detail/delete
- Dashboard visualizations with Recharts
- Chat UI with persisted `thread_id`
- Profile + local preferences (currency/theme)

---

## Core Features

- OCR for image and PDF receipts
- Multi-language parser routing (English/Arabic workflows)
- JWT authentication and user-scoped access control
- Receipt CRUD, pagination, and search
- AI chat over user spending data
- Currency conversion tool integration
- Optional per-route rate limiting
- Frontend dark mode and responsive layout

---

## Tech Stack

### Backend

- Python 3.11/3.12
- FastAPI
- SQLAlchemy 2.x + PostgreSQL
- Alembic
- LangChain + LangGraph + langgraph-supervisor
- Transformers + PyTorch
- slowapi (rate limiting)
- uv (dependency/runtime tooling)

### Frontend

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui (Base UI)
- TanStack Query v5
- Axios
- Recharts
- React Hook Form + Zod
- Sonner + Framer Motion + next-themes

---

## Repository Structure

```text
SpendHiST/
├── app/                         # FastAPI backend
│   ├── api/v1/                  # users, receipts, chat routes
│   ├── core/                    # security, db, deps, rate limit
│   ├── models/                  # SQLAlchemy models
│   ├── schemas/                 # Pydantic contracts
│   ├── services/                # business logic (chat/upload/receipts/users)
│   ├── ocr/                     # OCR engine
│   └── parser/                  # parsing pipeline
├── ai/
│   ├── agents/                  # supervisor, sql_agent, receipt_analyst
│   └── tools/                   # db/search/currency tools
├── spendhist-frontend/          # Next.js frontend
├── alembic/                     # migrations
├── alembic.ini
├── pyproject.toml
├── uv.lock
└── README.md
```

---

## Requirements

- Python 3.11 or 3.12
- Node.js 20+ (recommended) and npm
- PostgreSQL
- `uv` installed
- API keys for:
  - G0I OpenAI-compatible gateway (`G0I_API_KEY`)
  - CurrencyFreaks (`CURRENCYFREAKS_API_KEY`)
- Optional:
  - CUDA-capable GPU for faster OCR
  - Hugging Face token for gated models

---

## Environment Variables

Create `.env` in project root (backend), based on `.env.example`.

### Required (backend startup fails if missing)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/spendhist

MODEL_NAME_OCR=your_hf_ocr_model
PARSER_MODEL=your_parser_model
SQL_MODEL=your_sql_agent_model
AGENTIC_MODEL=your_supervisor_analyst_model

G0I_API_KEY=your_gateway_key
CURRENCYFREAKS_API_KEY=your_currencyfreaks_key
```

> Note: model requests are sent through the fixed gateway base URL `https://g0i.shop/v1`.

### Auth and API behavior

```env
JWT_SECRET_KEY=strong_random_secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

### Useful tuning knobs

- `DB_POOL_SIZE`, `DB_POOL_MAX_OVERFLOW`
- `DB_TOOL_MAX_LIMIT`, `DB_TOOL_MAX_JSON_BYTES`, `DB_TOOL_STATEMENT_TIMEOUT_MS`
- `MAX_UPLOAD_BYTES`, `MAX_PDF_PAGES`
- `DEFAULT_RECEIPT_PAGE_SIZE`, `MAX_RECEIPT_PAGE_SIZE`, `SEARCH_RESULTS_CAP`
- `RATE_LIMIT_*_PER_MINUTE`
- `CORS_ORIGINS`

Frontend env (`spendhist-frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## Backend Setup and Run

### 1) Install dependencies

```bash
uv sync
```

### 2) Prepare database

Run migrations:

```bash
uv run alembic upgrade head
```

### 3) Start API server

```bash
uv run uvicorn app.main:app --reload
```

Backend endpoints:

- API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- OpenAPI: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## Frontend Setup and Run

```bash
cd spendhist-frontend
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

Build for production:

```bash
npm run build
npm run start
```

---

## API Overview

### Users

- `POST /users/register`
- `POST /users/login`
- `GET /users/{user_id}` (must match token user)

### Receipts (Bearer token required)

- `POST /receipts`
- `GET /receipts` (paginated)
- `GET /receipts/search`
- `GET /receipts/{receipt_id}`
- `DELETE /receipts/{receipt_id}`
- `DELETE /receipts` (bulk confirmation body)
- `POST /receipts/upload` (multipart files)

### Chat (Bearer token required)

- `POST /chat` with:
  - request: `{ "message": "...", "thread_id": "optional" }`
  - response: `{ "reply": "...", "thread_id": "..." }`

> Chat endpoint is non-streaming: frontend waits for full response.

---

## Authentication Flow

1. User logs in and receives JWT + `user_id`
2. Frontend stores:
  - `spendhist_token`
  - `spendhist_user_id`
3. Axios interceptor attaches `Authorization: Bearer <token>`
4. On `401`, frontend clears auth and redirects to `/login`

---

## Chat Pipeline

`POST /chat` -> `chat_service.chat_turn()` -> LangGraph supervisor

Supervisor may:

- respond directly for simple requests
- call `sql_agent` for DB retrieval
- call `receipt_analyst_agent` for structured analysis
- optionally use tools (currency/search) based on query

Thread memory is checkpointed by scoped thread id:

- internal key: `"{user_id}:{thread_id}"`
- frontend persists `thread_id` in `localStorage`

---

## Performance and Timeout Notes

If chat feels slow:

- avoid heavy fields in agent search payloads (e.g., raw OCR text by default)
- constrain SQL query result size and selected columns
- reduce model token output limits
- add caching for frequent conversions/results
- ensure proxy/server timeouts exceed expected long-running turns

---

## Troubleshooting

### Backend fails at startup

- Check required `.env` values
- Confirm PostgreSQL is reachable from `DATABASE_URL`

### 401/403 issues

- Verify JWT token in frontend localStorage
- Ensure `/users/{user_id}` uses token owner ID

### CORS errors in browser

- Configure `CORS_ORIGINS` with frontend origin(s)
- Example: `http://localhost:3000`

### Chat timeouts

- Check model latency at gateway
- Check DB query complexity and limits
- Check agent prompt/tool payload size

### Frontend shows old assets/logo

- Hard refresh (`Ctrl + Shift + R`)
- Bust cache with query param/versioned filenames

---

## Production Recommendations

- Use managed Postgres with backups
- Use persistent LangGraph checkpoint backend (not in-memory only)
- Add centralized logging + tracing for agent steps
- Add metrics for latency percentiles (p50/p95/p99)
- Keep secrets in a vault/secret manager (not `.env` in deployment)
- Put API behind reverse proxy with explicit timeout settings
- Add CI checks (lint, typecheck, tests, migration checks)

---

