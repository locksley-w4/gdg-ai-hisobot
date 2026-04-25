# GDG AI Hisobot

AI-powered report generator using Google Vertex AI (Gemini), Node.js, React, and PostgreSQL.

## Features

- 🔐 JWT-based authentication (admin/user roles)
- 🤖 AI report generation via Google Vertex AI (Gemini)
- 📄 Report management (create, view, delete)
- 📋 Template management
- 🐘 PostgreSQL database
- 🐳 Docker Compose for easy deployment

## Quick Start

### 1. Configure environment variables

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set at minimum:
- `JWT_SECRET` — a strong random string
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your desired admin credentials (default: `admin` / `123`)
- `GOOGLE_CLOUD_PROJECT` — your GCP project ID

### 2. Add Google Cloud credentials

Place your service account JSON key at:
```
backend/credentials/service-account.json
```

See `backend/credentials/README.md` for details.

### 3. Start with Docker Compose

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Backend API on port 3001
- Frontend on port 5173

### 4. Log in

Open http://localhost:5173 and log in with:
- **Username:** `admin` (or the value of `ADMIN_USERNAME` in your `.env`)
- **Password:** `123` (or the value of `ADMIN_PASSWORD` in your `.env`)

## Development (without Docker)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # edit .env as needed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend port | `3001` |
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `123` |
| `DATABASE_URL` | PostgreSQL connection string | *(required)* |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | *(required for AI)* |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region | `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | `./credentials/service-account.json` |
| `VERTEX_AI_MODEL` | Gemini model to use | `gemini-1.5-pro` |

## Security

- Admin credentials are stored **only** in `.env` files — never hardcoded.
- Service account JSON keys are stored in `backend/credentials/` which is excluded from git.
- JWT tokens expire after 24 hours.
- Passwords are hashed with bcrypt (salt rounds: 10).
