# Jesse Chapter Factory

Cloudflare Worker API that serves ready-to-paste context prompts for the Jesse Adventures chapter-per-conversation writing system.

## What It Solves

Every new AI conversation loses context. This API maintains persistent state (D1 database) and generates complete context prompts on demand. Each chapter gets its own focused conversation with full project knowledge automatically assembled.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/context/:book/:chapter` | GET | **Main** — Full writing prompt for a specific chapter |
| `/api/master-context` | GET | Complete project context (no chapter focus) |
| `/api/status` | GET | Dashboard — all books, chapters, progress |
| `/api/books` | GET | List all books |
| `/api/chapters/:book` | GET | Chapters for a book |
| `/api/characters` | GET | All characters |
| `/api/canon` | GET | All canon facts |
| `/api/session` | POST | Log a completed writing session |
| `/api/chapter/:id` | PUT | Update chapter status, prose, word count |

## Workflow

1. Start new conversation
2. Fetch `GET /api/context/beanstalk/9` (or whatever chapter)
3. Paste the returned prompt into the conversation
4. Write the chapter
5. Log output: `POST /api/session`
6. Update chapter: `PUT /api/chapter/9` with {status: 'complete', prose: '...', word_count: 2500}
7. Next conversation: `GET /api/context/beanstalk/10`

## Deploy

```bash
npm install
npx wrangler deploy
```

## D1 Database

- Name: jesse-chapter-factory
- ID: dd91a213-b881-4b01-88bb-0e90dc43c825
- Schema: schema.sql

## Infrastructure

- Cloudflare Workers + D1
- GitHub: bermingham85/jesse-chapter-factory
