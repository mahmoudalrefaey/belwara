# بالورقة · Bel War’a

Bel War’a (Egyptian Arabic for “on paper, to the letter”) turns photos and PDFs of receipts into structured spending history, then lets you explore that history on a dashboard or by asking questions in English or Arabic.

- **Backend:** FastAPI, PostgreSQL, Azure OpenAI, Azure Blob Storage.
- **Frontend:** Next.js (App Router), next-intl (Arabic by default, English), TanStack Query, Tailwind v4, shadcn/ui on Base UI and framer-motion. See [frontend/README.md](frontend/README.md).

---

## Contents

1. [How it works](#how-it-works)
2. [Receipt lifecycle](#receipt-lifecycle)
3. [The spending assistant](#the-spending-assistant)
4. [Dashboard](#dashboard)
5. [Plans, quotas and cost tracking](#plans-quotas-and-cost-tracking)
6. [Data model](#data-model)
7. [Security model](#security-model)
8. [Repository structure](#repository-structure)
9. [Local setup](#local-setup)
10. [Configuration](#configuration)
11. [API reference](#api-reference)
12. [Testing and accuracy evaluation](#testing-and-accuracy-evaluation)
13. [Deploying to Azure](#deploying-to-azure)
14. [Design decisions](#design-decisions)
15. [Roadmap](#roadmap)

---

## How it works

There are three user-facing flows. They share one PostgreSQL database and one Azure OpenAI client.

```
                        ┌───────────────────────────── Next.js frontend ─────────────────────────────┐
                        │  Dashboard      Receipts (upload, review, edit)      Chat      Profile     │
                        └───────┬───────────────────┬──────────────────────────┬───────────────┬─────┘
                                │ JWT               │                          │               │
                        ┌───────▼───────────────────▼──────────────────────────▼───────────────▼─────┐
                        │                              FastAPI                                       │
                        │  upload_service   extract_service   receipt_service   chat_service  quota  │
                        └───┬──────────────────┬───────────────────┬──────────────────┬──────────────┘
                            │                  │                   │                  │
                     Azure Blob Storage   Azure OpenAI        PostgreSQL        Azure OpenAI
                     (original files)     (vision, 1 call)    (all data)        (chat + tools)
```

| Flow | In one sentence |
|---|---|
| **Capture** | Upload a file, store it, and extract merchant, date, items and totals with one vision-model call, in the background. |
| **Review** | Anything doubtful is flagged "needs review". The user sees the original beside the extracted data and corrects it. |
| **Insight** | A dashboard and a chat assistant answer from the data. Every number is computed by backend code (SQL and `Decimal` arithmetic), never by the model. |

---

## Receipt lifecycle

```
POST /receipts/upload
        │  validate type and size, check monthly quota
        ▼
  file saved to storage  ──▶  receipt row created: status = processing  ──▶  HTTP 202 returned
                                        │
                                        │  background task (FastAPI BackgroundTasks)
                                        ▼
                      load file ─▶ prepare pages ─▶ ONE vision call (structured output)
                                        │
                                        ▼
                         deterministic checks (build_receipt_data)
                         ┌──────────────┴──────────────┐
                    no problems                  one or more reasons
                         │                              │
                  status = ready              status = needs_review
                                                  (review_reasons lists why)

   model error / unreadable file / not a receipt  ──▶  status = failed (reason stored)
```

### Extraction (`app/services/extract_service.py`)

1. **Prepare the file.** Images are corrected for EXIF rotation, downscaled to at most 2048 px on the long side and re-encoded as JPEG. PDFs are rendered page by page at 200 dpi (at most `MAX_PDF_PAGES`, default 5).
2. **One model call.** All pages go in a single message at `detail: "high"`. The model returns the `ExtractedReceipt` schema through Azure's structured output, so the reply is always valid JSON that matches the schema. No fence stripping, no repair call.
3. **The schema** holds: a full transcription (`raw_text`), `is_receipt`, merchant, date, currency (a fixed list of ISO codes), category, line items, subtotal, taxes and tax rate, other charges (tips, service, delivery), total, and the separate fields `amount_paid` and `change_due`.
   - Keeping paid and change apart from the total is the main defence against the classic mistake of reading the cash handed over as the bill.
   - `raw_text` is declared first, so the model transcribes the receipt before filling in fields.

### Deterministic checks (`build_receipt_data`)

These run in plain Python after the model call. Most of them only flag a problem. The only automatic correction is the paid/change rule below.

| Check | Result |
|---|---|
| `total == amount_paid` while `change_due > 0` (or total missing) | **Fixed:** `total = amount_paid − change_due` |
| Missing merchant, date, total or currency | flag `missing_<field>` |
| Total is zero or negative | flag `invalid_total` |
| Date more than a day in the future, or older than 2 years | flag `date_in_future`, `date_too_old` |
| An item's unit price × quantity doesn't match its line total (2% tolerance) | flag `line_price_mismatch` |
| Sum of item totals matches neither the total, the total minus tax and charges, nor the subtotal (2% tolerance) | flag `items_sum_mismatch` |
| Another non-failed receipt with the same merchant, date and total | flag `possible_duplicate` |
| Model says it isn't a receipt | status `failed`, reason `not_a_receipt` |

Quantities are a count or, for goods sold by weight, the weight (`Numeric(10,3)`: 1.5 kg is stored as 1.5, not rounded into the item name). Missing unit or line prices are filled from quantity. Per-item tax is `line_total × tax_rate / 100` when a rate was printed.

Currency codes are validated against ISO 4217 (`app/core/currencies.py`) when a receipt is created or corrected, and the edit form only accepts real codes. Migration `004` flagged receipts stored earlier with a code that isn't a currency (`needs_review`, reason `invalid_currency`), keeping the stored value so the user can see and fix it.

### Recovery and corrections

- **A receipt is never discarded** because extraction was imperfect. It is saved, flagged, and the user decides.
- `PATCH /receipts/{id}` applies the user's corrections and sets the status to `ready` (merchant, date, total and currency must all be present).
- `POST /receipts/{id}/reprocess` re-runs extraction on a `failed` or `needs_review` receipt, for example after a prompt or model improvement.
- **Restart safety.** At startup the API re-claims receipts stuck in `processing` for more than 10 minutes. The claim is a single `UPDATE … RETURNING` that bumps `updated_at`, so two replicas never process the same receipt.

---

## The spending assistant

```
user message
     │
     ▼
 static system prompt + last 20 messages of this thread (DB) + user message
 + context message (today's date, main currency, reply language)
     │
     ▼
 ┌─ model call ──────────────────────────────┐
 │   wants data?  ──yes──▶ run tool(s) in code ─▶ feed JSON results back ─┐
 │        │ no                                                            │
 │        ▼                                  (at most 5 steps; the last step has tools disabled)
 │   final answer ◀──────────────────────────────────────────────────────┘
 └───────────────────────────────────────────┘
     │
     ▼
 save user + assistant messages ─▶ return {reply, thread_id}
```

The system prompt and tool specs never change, so they form a prefix the model provider can cache; everything per-request goes in the context message after the user's message. The reply language is decided from which script most words of the message are in (a shop name in Arabic inside an English question doesn't make it Arabic), and the prompt asks for the same register (Egyptian, Gulf, MSA, English, Franco). Behaviour rules the prompt sets, beyond scope and voice: work out the period, level and currency first; state only numbers that appear in a tool result (totals, daily averages, differences, percentages and conversions all have a tool field); use sort options for "biggest", "latest", "cheapest"; read every result's status (say what was searched when nothing matched and where data does exist, ask or report separately when merchants are ambiguous, say which stored name a match was found under, never surface errors); mention review state, missing totals or approximate conversions when they matter to the answer; ask a question only when the answer depends on it; never claim to have changed data. Each turn logs its rounds, tool calls, tokens and latency.

### Tools

Every tool returns an envelope: `status` (`ok`, `no_results`, `ambiguous`, `error`), the data, what was `searched` when nothing matched, and `limitations` (receipts without a total that were left out, how much of a figure rests on receipts that need review). Amounts are exact decimals; dates are `YYYY-MM-DD`.

| Tool | Arguments the model can set | Returns |
|---|---|---|
| `spending_summary` | start, end, group_by (merchant / category / month / day), merchant (+ alternatives), category, currency, convert_to, compare_start, compare_end | per currency: total, receipts, average, tax, other charges, needs-review share, verified count; `daily_average` for a date range; converted totals with their rate basis; differences and percent change against a second period |
| `find_receipts` | start, end, merchant (+ alternatives), category, currency, status (counted / needs_review / failed / processing / all), text, sort (newest / oldest / largest / smallest / recently_uploaded), limit | receipts with total, tax, status, `verification` and review reasons; by-amount sorts are ranked within each currency |
| `get_receipt` | receipt_id | one receipt with line items, items total, tax, charges, missing fields, and whether the items add up |
| `find_items` | query (+ alternatives), merchant (+ alternatives), start, end, mode (list / summary), sort (newest / highest_price / highest_total), limit | purchases, or per item: times bought, total quantity and total spent |
| `account_overview` | — | receipts by status (including failed and processing), first and latest receipt dates, currencies, receipts that need review and why |
| `show_receipts` | receipt_ids (1–5) | attaches the user's own receipts to the reply as cards |
| `convert_currency` | amount, from, to | converted amount, rate basis and date |

**Finding what people mean** (`app/services/match_service.py`). Merchant and item names are typed by people and stored by OCR, so they rarely match exactly. Every tool that takes a name resolves it against the user's own stored names in layers: exact, then normalized (one form per Arabic letter, no diacritics or tatweel, Western digits, case and accents folded), then "contains" (every word typed appears in the stored name), then fuzzy. Fuzzy matching aligns words by edit distance on the normalized text and on an OCR *skeleton* where letters that print alike are folded together (ب ت ث ن ي, ج ح خ, ع غ ف ق …), so a stored "حواوشى فلاء" is found for "حواوشي علاء" while "حلواني علاء" is not. Words the person typed that the stored name lacks count against it, except business words like مطعم or "store". Stored spellings of one merchant are clustered, so a breakdown by merchant shows one row with its other spellings listed. When two different merchants match about equally well (a shared first name, say), the tool returns `ambiguous` with each one's figures and the assistant asks or reports them separately; a period or category can settle it when only one has receipts there. Below the bar, nothing is returned except "nearest" names. Stored names are never rewritten. The model may pass `alternatives` (the name in the other script, a transliteration, a synonym such as فلافل for طعمية); that is the model's language knowledge, not a dictionary in the code. Thresholds are calibrated on the dev pool of `evals/run_retrieval.py` and checked on the holdout pool (100% hits on exact, typed and typo queries, 0% confident wrong matches). *Limits:* names written only in another script are found only if the model offers the alternative; very short words (four letters or fewer) must match exactly or as an OCR look-alike, so a one-letter typo in a short name is missed; scoring runs in Python over the user's distinct names (a few hundred ms at ~2,000 names), and larger accounts would need a `pg_trgm` prefilter.

**Verification.** Each receipt is `verified` (the user confirmed or corrected it, `receipt.confirmed_at`), `extracted` (accepted by the automatic checks) or `needs_review`. Tools report this so answers can say when a figure rests on values nobody has checked.

**Currency conversion** (`app/services/fx_service.py`) converts each receipt day at that day's rate when historical rates are available (cached in `fx_rates`; they never change) and otherwise at today's rate, marked `approximate`. Historical rates need a paid CurrencyFreaks plan; on the free plan the API refuses them, the service stops asking, and every conversion is labelled as today's rate. Codes with no published rate are left out and listed.

### Why it's accurate and safe

- **The model never calculates and never writes SQL.** It picks a tool and fills typed arguments. Totals, averages, daily averages, differences, percentages and conversions are computed by backend code with `Decimal` arithmetic.
- **`user_id` is not an argument.** Tools are closures built per request (`build_tools(db, user_id)`), so a prompt-injected "show me user 2's data" cannot change who is queried.
- Tool schemas are `strict`: the model's arguments always validate.
- Only `ready` and `needs_review` receipts count in totals. `processing` and `failed` receipts are excluded, and receipts without a readable total are counted separately instead of skewing averages.
- Currencies are never mixed: totals are per currency, ranking by amount happens within a currency, and a single figure across currencies only comes from a conversion that states its basis.
- A tool error comes back as `{"status": "error", "error": {code, retryable}}` without internal details, and the database session is rolled back so one failure can't poison the rest of the turn.

### History

Conversations live in `chat_messages` (user, thread, role, content, attachments). The frontend keeps only the current `thread_id`, so history survives restarts and devices. `GET /chat/threads` lists conversations for a history screen.

**Receipt cards.** When an answer is about specific receipts, the model calls `show_receipts` (at most five, and only the user's own; other ids are dropped). The cards are returned with the reply, saved in the assistant message's `attachments`, and shown under the bubble; tapping one opens it at `/receipts?open=<id>`. Tool results aren't replayed into later turns, so the history the model sees includes a one-line note of the cards shown with each earlier reply, in order. That is how "what did I buy in the second one?" finds the right receipt.

---

## Dashboard

`GET /receipts/dashboard?currency=EGP` computes everything in SQL for **one currency at a time**: total, receipt count, average, this month, last 12 months, top 5 merchants, spend by category, and how many receipts need review. If the requested currency is missing, the server falls back to the user's most-used one. The frontend shows a currency switcher when there is more than one currency, and a banner linking to receipts that need review.

---

## Plans, quotas and cost tracking

- Every model call writes an `llm_usage` row: user, kind (`receipt` or `chat`), deployment, input and output tokens. Summing it gives cost per user.
- Each user has a `plan` (`free` or `pro`). Monthly limits are in `PLAN_LIMITS` (config): defaults are free = 30 receipts and 50 chat messages, pro = 500 and 2000. `0` means unlimited.
- Going over a limit returns **HTTP 402** with the plan, used and limit. The upload quota is checked for the whole batch before anything is stored.
- `GET /users/me/usage` powers the usage bars on the profile page.
- **Not built yet:** taking payments and flipping `plan` to `pro`. See the [roadmap](#roadmap).
- IP rate limits (slowapi) still protect register, login, upload and chat from bursts.

---

## Data model

```
users ──< receipt ──< receipt_items
  │
  ├──< chat_messages        (user_id, thread_id, role, content, attachments)
  └──< llm_usage            (user_id, kind, deployment, input_tokens, output_tokens)

fx_rates                    (rate_date, currency, usd_rate) — historical exchange-rate cache
```

All child tables use `ON DELETE CASCADE`, so deleting a user removes everything they own.

**`receipt`** key columns:

| Column | Notes |
|---|---|
| `status` | `processing`, `ready`, `needs_review`, `failed` |
| `review_reasons` | JSON list of reason codes (or an extraction error message) |
| `merchant_name`, `receipt_date`, `total_amount`, `currency` | Nullable, because they are unknown while processing |
| `total_taxes`, `other` | Never null; default 0 |
| `category` | groceries, dining, transport, shopping, bills, health, entertainment, other |
| `raw_text` | The model's transcription; used by search |
| `image_key` | Storage key of the original: `{user_id}/{uuid}{ext}` |
| `confirmed_at` | When the user confirmed or corrected it (values are then verified, not just extracted) |
| `updated_at` | Used to detect stuck jobs |

Indexes: `(user_id, receipt_date)` for date-range queries, `status`, `receipt_items(receipt_id)`, `chat_messages(user_id, thread_id, id)`, `llm_usage(user_id, created_at)`.

---

## Security model

| Concern | How it's handled |
|---|---|
| Data isolation | Every service function takes a required `user_id`; every query filters on it. The chat model can't set it. |
| Authentication | bcrypt (SHA-256 pre-hash to avoid the 72-byte limit); JWT bearer tokens; inactive accounts can't log in |
| Brute force | Rate limits on register, login, upload and chat |
| Uploads | Allow-listed extensions, size cap (15 MiB), file-count cap (10), PDF page cap; files that can't be decoded fail cleanly |
| Files | Stored under the owner's prefix and served only through an authenticated owner check |
| Secrets | Azure access via managed identity; no key needed in production |
| Privacy | `GET /users/me/export` (JSON of everything stored) and `DELETE /users/me` (password required; removes rows and stored files) |

---

## Repository structure

```text
app/
├── main.py              app setup, CORS, health check, restart recovery, telemetry
├── config.py            all settings, read once from .env
├── api/v1/              users.py, receipts.py, chat.py (thin HTTP layer)
├── core/                database, auth dependencies, JWT/password, rate limits, llm.py (Azure client)
├── models/              users, receipt (+items), chat_messages, llm_usage
├── schemas/             Pydantic request/response contracts
└── services/
    ├── extract_service.py   image/PDF prep, the vision call, deterministic checks
    ├── upload_service.py    accept uploads, background pipeline, stale-job recovery
    ├── receipt_service.py   queries, search, aggregates, dashboard
    ├── chat_service.py      the model ⇄ tools loop and history
    ├── chat_tools.py        tool schemas and per-user tool binding
    ├── quota_service.py     monthly plan limits
    ├── storage_service.py   Azure Blob or local folder
    └── user_service.py      accounts, export, deletion
alembic/versions/001_baseline.py   full schema
evals/                accuracy evaluation scripts
tests/                unit and integration tests
frontend/             Next.js app (Arabic/English, RTL)
Dockerfile · .github/workflows/ci.yml
```

---

## Local setup

**Requirements:** Python 3.11 or 3.12 and [`uv`](https://docs.astral.sh/uv/), Node.js 20+, PostgreSQL 15+, and an Azure OpenAI deployment of a model that supports **vision, structured outputs and tool calling** (one deployment can serve both receipts and chat).

```bash
cp .env.example .env              # fill in the values (see Configuration)
uv sync
uv run alembic upgrade head       # creates the schema
uv run uvicorn app.main:app --reload
# API docs: http://127.0.0.1:8000/docs
```

```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=/api" > .env.local   # Next proxies /api/* to BACKEND_URL (default http://127.0.0.1:8000)
npm install
npm run dev                       # http://localhost:3000 → /ar (Arabic) or /en
```

With no `AZURE_STORAGE_*` set, uploads are stored in `RECEIPTS_IMG_DIR` (default `receipts_img/`).

---

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL URL |
| `JWT_SECRET_KEY` | yes | Long random string |
| `AZURE_OPENAI_ENDPOINT` | yes | `https://<resource>.openai.azure.com` (without `/openai/v1`) |
| `RECEIPT_DEPLOYMENT`, `CHAT_DEPLOYMENT` | yes | Azure **deployment** names (not model names) |
| `AZURE_OPENAI_API_KEY` | no | If empty, the app signs in with its managed identity |
| `AZURE_STORAGE_ACCOUNT_URL` | no | Blob storage with managed identity (production) |
| `AZURE_STORAGE_CONNECTION_STRING` | no | Blob storage with a connection string (e.g. Azurite) |
| `AZURE_STORAGE_CONTAINER` | no | Default `receipts` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | no | Enables request, SQL and log telemetry |
| `CURRENCYFREAKS_API_KEY` | no | Enables currency conversion in chat |
| `CORS_ORIGINS` | no | Comma-separated frontend origins; empty allows all without credentials |

Tuning: `MAX_UPLOAD_BYTES`, `MAX_FILES_PER_UPLOAD`, `MAX_PDF_PAGES`, `LLM_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES`, `CHAT_HISTORY_MESSAGES`, `CHAT_MAX_TOOL_STEPS`, `FREE_*`/`PRO_*` quota variables, `RATE_LIMIT_*_PER_MINUTE`, `DB_POOL_SIZE`, `DB_POOL_MAX_OVERFLOW`.

---

## API reference

All routes except register, login and `/health` need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/users/register`, `/users/login` | Create an account; get a JWT |
| GET | `/users/{id}` | Own profile only (others return 404) |
| GET | `/users/me/usage` | This month's usage vs plan limits |
| GET | `/users/me/export` | Download all your data as JSON |
| DELETE | `/users/me` | Delete the account (body: `{password}`) |
| POST | `/receipts/upload` | Multipart `files`; returns **202** with `processing` receipts |
| GET | `/receipts` | Paginated list; filters `status`, `start`, `end`, `merchant`, `category` |
| GET | `/receipts/search?q=` | Search merchant, items, currency and receipt text |
| GET | `/receipts/dashboard?currency=` | Dashboard numbers for one currency |
| POST | `/receipts` | Manual entry (all core fields required) |
| GET / PATCH / DELETE | `/receipts/{id}` | Detail / correct (sets `ready`) / delete (also deletes the file) |
| POST | `/receipts/{id}/reprocess` | Re-run extraction on a `failed` or `needs_review` receipt |
| GET | `/receipts/{id}/image` | The original upload (owner only) |
| DELETE | `/receipts` | Delete all; body `{"confirm": "DELETE_ALL_RECEIPTS"}` |
| POST | `/chat` | `{message, thread_id?}` → `{reply, thread_id, receipts}` (receipt cards attached to the reply) |
| GET | `/chat/threads`, `/chat/threads/{id}` | Conversation list and messages (with their receipt cards) |
| GET | `/health` | Liveness probe |

Error responses worth handling in clients: `402` quota reached, `429` rate limited, `503` assistant temporarily unavailable.

---

## Testing and accuracy evaluation

```bash
uv run pytest                                       # unit tests
TEST_DATABASE_URL=postgresql://... uv run pytest    # + integration tests
uv run ruff check app alembic tests evals
```

> The integration tests **wipe the database** they point at. Use a disposable one.

The integration tests run the real SQL, storage, background jobs and HTTP layer with a faked model. They cover tenant isolation, per-currency aggregates, duplicate and failure handling, stuck-job recovery, quotas, export and account deletion, and that the migration matches the models.

**Accuracy is measured, not assumed:**

- `uv run python -m evals.run_receipts` runs real receipts from `evals/receipts/` against `expected.json` (see `evals/expected.example.json`). It prints per-field accuracy (merchant, date, total, currency, category, item count) and saves a result file. Run it before changing the model, the prompt or the schema, and compare against the saved baseline.
- **Chat evals** run against generated users whose ground truth is known, so expected answers are computed, not typed in:

  ```bash
  uv run python -m evals.fixtures.generate --pool dev --seed 7          # writes eval-dev-*@belwara.test users
  uv run python -m evals.fixtures.generate --pool holdout --seed 1001
  uv run python -m evals.run_chat --split regression                    # or dev, holdout, all; --runs 3
  uv run python -m evals.run_retrieval                                  # merchant-name matching, no LLM
  ```

  - *Data.* `evals/fixtures/generate.py` builds six profiles per pool: a household, a traveller with several currencies, a light user, a messy-OCR user, a dormant user and one with nothing readable. They cover every receipt status, taxes, weighed items, missing totals, an invalid currency code and an item whose text tries to give the assistant instructions. Merchant names are damaged by an OCR noise model (`evals/fixtures/noise.py`) whose letter confusions are deliberately broader than anything the matcher folds together. The ground truth stays in `evals/results/fixtures/<pool>.json`; `evals/fixtures/oracle.py` computes expected answers from it in plain Python, independent of the app's SQL.
  - *Splits.* `regression` rewrites every failure from the chat audit as a generic case. `dev` is used while building. `holdout` was written before the fixes, with its own merchants, seed, question types and wording; it only runs at milestones, and failures there are fixed by class, never case by case.
  - *Scoring.* Each check counts toward a dimension: retrieval, calculation, tool selection, tool arguments, faithfulness, correctness, Arabic/language, missing or ambiguous data, safety, action safety, efficiency. Every turn is also checked for **critical** failures, which must stay at zero: an amount that appears in no tool result (how model arithmetic and mixed-currency sums show up), a currency the data doesn't support, a merchant the user never visited, unsafe content from injected text, or claiming an action was done. Gates: no critical failures, ≥ 90% overall, ≥ 80% per dimension, p95 latency ≤ 10 s.
  - *Judge.* Behavior, register and action claims are graded by `evals/judge.py`; everything else is deterministic. Set `EVAL_JUDGE_DEPLOYMENT` to a stronger deployment than the one under test; without it the model judges itself and the report says so, so spot-check its verdicts.
  - Nothing is saved: turns run through `chat_service.answer()` and are rolled back. `--user-id N --cases file.json` still runs the older expect/forbid format against a real user.

Eval receipts and results are gitignored because they can contain personal data.

CI (`.github/workflows/ci.yml`) runs lint, all tests against a Postgres service, the frontend lint and build, and a Docker build on every PR.

---

## Deploying to Azure

| Piece | Azure service |
|---|---|
| API (this Dockerfile) | Container Apps, 1–3 replicas, port 8000, health probe `/health` |
| Database | Azure Database for PostgreSQL Flexible Server, automated backups on |
| Receipt files | Storage account with a private container |
| Models | Azure OpenAI; use a Data Zone or Regional deployment if data residency matters |
| Telemetry | Application Insights |
| Frontend | Vercel or Azure Static Web Apps, with `NEXT_PUBLIC_API_URL` set to the API |

1. Give the Container App a **system-assigned managed identity**. Grant it **Cognitive Services OpenAI User** on the OpenAI resource and **Storage Blob Data Contributor** on the storage account. Leave `AZURE_OPENAI_API_KEY` empty and set `AZURE_STORAGE_ACCOUNT_URL`.
2. Store `DATABASE_URL` and `JWT_SECRET_KEY` as Container Apps secrets (or Key Vault references).
3. Set `CORS_ORIGINS` to the frontend URL.
4. Run `alembic upgrade head` **once per release** before rolling out the new image (from CI or a Container Apps job). Replicas do not migrate at startup.
5. Watch Application Insights for the `failed` receipt rate, 5xx responses and `llm_usage` log lines (tokens per call).

**Capacity notes.** Azure OpenAI limits tokens per minute per deployment; the SDK retries 429s (`LLM_MAX_RETRIES`). Background extraction runs inside the API process, which is fine for modest traffic. If you outgrow it, move `process_receipt` to a queue worker without changing anything else, since the status column already drives the UI.

---

## Design decisions

- **One vision call instead of OCR then parsing.** Plain-text OCR loses layout, which is what separates a total from a payment line. The model reads the image directly and returns typed JSON.
- **Flag, don't reject.** Users prefer fixing one field to re-uploading. Flagged receipts still count in totals, and the dashboard and chat call them out so the numbers aren't trusted blindly.
- **Code computes, the model phrases.** Sums, averages and trends come from SQL; the model chooses a tool and writes the sentence.
- **Fixed tools over generated SQL.** A small set of typed tools covers the questions people ask about receipts, and they can be tested and scoped to a user in code.
- **A status column instead of a job queue.** It gives progress in the UI, restart recovery and retries with no extra infrastructure.
- **No agents framework, no vector database.** The data is small and structured; SQL is the right retrieval layer.

---

## Roadmap

- [ ] Payments: checkout, customer portal, and a webhook that sets `users.plan` (provider depends on where the business is registered).
- [ ] Email verification and password reset.
- [ ] Chat history list in the web UI (the endpoints exist).
- [ ] Email forwarding import: a receipt-forwarding address that feeds the same extraction pipeline.
- [ ] Mobile app on the same API.
