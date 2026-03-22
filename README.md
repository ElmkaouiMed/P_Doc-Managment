# web_admin

Next.js admin app for DOC_v1.

## Commands

- `npm run dev`
- `npm run lint`
- `npm run db:format`
- `npm run db:generate`
- `npm run db:migrate`

## Environment

- `DATABASE_URL`
- `AUTH_SECRET`
- `DOCUMENT_ENGINE_URL` (optional, default: `http://127.0.0.1:8000`)
- `DOCUMENT_ENGINE_TOKEN` (optional bearer token for Python engine)
- `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_FULL_NAME`, `DEMO_COMPANY_NAME` (optional demo workspace seed)

## Current scaffold

- POS-style app shell (sidebar + header + content card)
- Main routes: dashboard, documents, imports, templates, exports, clients, products, notifications, settings
- Settings tabs for:
  - Email configs
  - General info
  - Templates metadata
  - Notifications
- Multi-tenant Prisma baseline schema
