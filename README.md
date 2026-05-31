# Valence

**Operational Intelligence Platform for Real Estate & Property Management**

Valence delivers financial visibility, lease intelligence, anomaly detection, renewal risk monitoring, and decision-support infrastructure for enterprise property management firms.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Zustand, TanStack Query, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma ORM, Zod |
| Database | PostgreSQL |
| Auth | JWT (access + refresh), bcrypt |

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Docker + Docker Compose (for local Postgres)

---

## Local Development

```bash
# 1. Clone and install
git clone <repo>
cd valence
npm install

# 2. Environment
cp .env.example server/.env

# 3. Start database
docker compose up -d

# 4. Migrate + seed
npm run db:migrate
npm run db:seed

# 5. Run dev servers
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Prisma Studio: `npm run db:studio`

---

## Architecture

```
valence/
├── client/          # React 19 frontend (feature-driven)
├── server/          # Express backend (domain-driven modules)
├── shared/          # Shared TypeScript types + Zod schemas
└── docs/            # Architecture decision records
```

---

## Modules

- **Auth** — JWT registration, login, refresh, role-based access
- **Properties** — Property lifecycle management
- **Leases** — Lease intelligence, expiration tracking, renewal risk
- **Finance** — Revenue tracking, expense records, discrepancy detection
- **Analytics** — KPIs, trend forecasting, operational summaries
- **Alerts** — Anomaly detection, expiration alerts, data quality flags
- **AI** — Pluggable intelligence layer (mock → LLM-ready)
