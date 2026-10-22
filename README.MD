# SmartStock App V0.9

React + Node.js + PostgreSQL application featuring product and supplier photos, supplier orders, product soft deletion, and AI Insights with local fallback and support for external AI providers.

## Backend

```bash
cd backend
npm install
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Database

Create a PostgreSQL database and execute:

- `database/schema_final.sql`
- `database/seed_final.sql`

## Environment Variables

In the frontend, set `VITE_API_URL=http://localhost:5000/api`.

In the backend, fill in the `.env` file with your machine's credentials.

To enable AI features, refer to `docs/AI_SETUP.md`.

## Documentation

- `docs/AI_SETUP.md`
- `docs/api-docs.md`
- `docs/architecture.md`
- `backend/uploads/README_UPLOADS.md` 