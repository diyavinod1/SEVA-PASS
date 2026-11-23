# SEVA PASS — Supabase Environment & Database Setup Guide

This guide explains how to link your own Supabase project to **SEVA PASS** with zero disruption to existing application workflows.

---

## 1. Architectural Overview

SEVA PASS features a **dual-engine architecture**:
- **Offline / Local Mode (Default):** Operates on `backend/seva_pass.db` (SQLite) with zero setup required. All pass generation, Ed25519 cryptographic signing, role portals, and QR verification function seamlessly.
- **Supabase Cloud Mode:** When your Supabase credentials are configured, the platform is ready for cloud PostgreSQL persistence, Row Level Security (RLS), and PostgREST API integration.

---

## 2. Environment Files Created

The following configuration files are prepared in the project:

| Location | File | Purpose | Security Rule |
| :--- | :--- | :--- | :--- |
| `backend/` | `.env` | Backend server & Supabase private config | **RESTRICTED**: Contains server-side service-role key |
| `backend/` | `.env.example` | Template with placeholders for backend | Safe to commit |
| `frontend/` | `.env` | Frontend endpoint & Supabase public config | **PUBLIC**: Only contains anon key and API URL |
| `frontend/` | `.env.example` | Template with placeholders for frontend | Safe to commit |
| Root | `.env` | Project-wide reference file | Local development only |
| Root | `.env.example` | Root template with placeholders | Safe to commit |
| Root & Subdirs | `.gitignore` | Prevents `.env`, `.db`, and `.pem` from leaking to Git | **Active** |

---

## 3. Step-by-Step Setup Instructions

### Step 1: Obtain Your Supabase Project Credentials
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project (or create a new project).
3. Navigate to **Project Settings** (gear icon) -> **API**:
   - Copy **Project URL** (e.g., `https://abcdefghijkl.supabase.co`)
   - Copy **anon / public** key (under Project API Keys)
   - Copy **service_role** key (under Project API Keys — click *Reveal*)
4. (Optional direct PostgreSQL connection): Navigate to **Project Settings** -> **Database**:
   - Under **Connection string**, select **URI** and copy the URI.

---

### Step 2: Execute the Database Schema

You have two safe execution options depending on whether you are using a new demo project or an existing project:

#### Option A: Clean 1-Step Setup on a Dedicated Demo Project (RECOMMENDED)
If you create a fresh demo project in Supabase (e.g. `sevapass-demo`):
1. In the Supabase Dashboard, click on **SQL Editor** -> **New Query**.
2. Open [`supabase/demo_schema.sql`](file:///Users/diyavinod/Downloads/SEVAPASS_NEW/supabase/demo_schema.sql), copy its entire contents, paste it into the editor, and click **Run**.
3. This creates all tables with the exact column types (`VARCHAR(64)` with `uuid_generate_v4()::text`), adds all required backend columns, configures least-privilege role permissions, and establishes non-cascading deletion protection for legal military passes.

#### Option B: Additive Migration on an Existing Supabase Project
If reusing an existing Supabase project:
1. Open **SQL Editor** -> **New Query**.
2. Run [`supabase/migrations/01_render_supabase_setup.sql`](file:///Users/diyavinod/Downloads/SEVAPASS_NEW/supabase/migrations/01_render_supabase_setup.sql) to normalize check constraints and least-privilege role permissions.
3. Open a second **New Query**.
4. Run [`supabase/migrations/02_id_foreign_key_compatibility.sql`](file:///Users/diyavinod/Downloads/SEVAPASS_NEW/supabase/migrations/02_id_foreign_key_compatibility.sql) to dynamically update foreign keys, add missing columns, and convert UUID columns to `VARCHAR(64)`.

---

### Step 3: Enter Your Credentials in `backend/.env`
Open [`backend/.env`](file:///Users/diyavinod/Downloads/SEVAPASS_NEW/backend/.env) and populate the values:

```bash
# --- SUPABASE CONFIGURATION ---
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Optional direct PostgreSQL connection:
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres

# Set DB_MODE to "supabase" to switch active engine from sqlite to supabase
DB_MODE=sqlite
```

---

### Step 4: Enter Your Public Credentials in `frontend/.env`
Open [`frontend/.env`](file:///Users/diyavinod/Downloads/SEVAPASS_NEW/frontend/.env) and populate the public values:

```bash
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT:**
> Never place `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env` or any client-facing file. The service role key bypasses Row Level Security and must only be kept on the backend server.

---

## 4. Startup & Verification

### Start the Full Stack Application
From the project root directory, run:
```bash
./start_all.sh
```

Or start the services individually in separate terminals:

**Backend:**
```bash
cd backend
./venv/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Checking Configuration Status
When the backend starts, it displays an automated startup audit in the console:
```
============================================================================
  SEVA PASS v2.0.0 — SYSTEM STARTUP VALIDATION
============================================================================
 [✓] Environment File:     .../backend/.env
 [✓] Cryptography Engine:  Ed25519 RFC 8032 (Key ID: seva-ed25519-v1)
 [✓] JWT Token Engine:     HS256 [INITIALISED]
 [✓] Active DB Engine:     SQLITE
----------------------------------------------------------------------------
  SUPABASE CLOUD CONFIGURATION AUDIT:
  • SUPABASE_URL:              https://your***.supabase.co
  • SUPABASE_ANON_KEY:         [CONFIGURED: eyJh...****]
  • SUPABASE_SERVICE_ROLE_KEY: [CONFIGURED: eyJh...****]
  • DATABASE_URL (PostgreSQL): False
============================================================================
```

You can also check the configuration status at any time via the API:
- Status API: `http://127.0.0.1:8000/api/config/status`
- Health API: `http://127.0.0.1:8000/api/health`
- Live Supabase Ping: `http://127.0.0.1:8000/api/supabase/status`

---

## 5. Production Security & Key Management

### Fail-Closed Database Policy
- **Production Mode (`ENVIRONMENT=production`):**
  - SQLite is strictly prohibited and refused at startup.
  - A valid PostgreSQL connection string (`DATABASE_URL`) is required.
  - If PostgreSQL is unreachable or drops connection, the backend **fails closed** with a fatal exception. It will **never** silently fall back to an ephemeral SQLite database.
- **Development Mode (`ENVIRONMENT=development`):**
  - Allows local SQLite operation (`seva_pass.db`) when `DB_MODE=sqlite` for completely offline testing and demonstrations.

### Generating a Fresh Production Ed25519 Signing Key
For production deployments on Render, generate a fresh Ed25519 private key locally and set it directly in Render's Environment Variables (do **not** commit it to Git or paste it into shared chats):

```bash
# Generate a new 32-byte Ed25519 private key as a 64-character hex string:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

1. Copy the output 64-character hex string.
2. In the Render Dashboard, open `seva-pass-api` -> **Environment**.
3. Set `ED25519_PRIVATE_KEY_HEX` to your generated hex value.
4. Production refuses to start if this key is missing, ensuring cryptographic continuity and non-repudiation across deployments.

---

## 6. Render Blueprint Cloud Deployment

The repository includes a ready-to-use [`render.yaml`](file:///Users/diyavinod/Downloads/SEVAPASS_NEW/render.yaml) blueprint configuring both services:
1. `seva-pass-api` — FastAPI Python Web Service (Backend).
2. `seva-pass-ui` — React + TypeScript Static Site (Frontend).

### Deployment Steps:
1. Push this repository to your GitHub account (private repository recommended).
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your repository. Render automatically reads `render.yaml`.
5. Under **Environment Variables** for `seva-pass-api`:
   - Enter your `DATABASE_URL` (Supabase Transaction Pooler URL on port 6543).
   - Enter your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   - Enter your generated `ED25519_PRIVATE_KEY_HEX`.
   - `JWT_SECRET` is automatically generated by Render.
   - `CORS_ORIGINS` is automatically bound to the deployed `seva-pass-ui` URL.
6. Click **Apply**.
7. Render will build and deploy both services.

---

## 7. Post-Deployment Demonstration Smoke-Test Checklist

Once deployed, verify the complete presentation workflow using the deployed URL:

- [ ] **1. Service Health Check:**  
  Navigate to `https://<your-api>.onrender.com/api/health` and verify `"database_engine": "supabase"`.
- [ ] **2. Homepage & Public Lookup:**  
  Visit `https://<your-ui>.onrender.com`. Verify the institutional theme (#14243A, #B99A62), navigation, and footer.
- [ ] **3. Central Admin Dashboard:**  
  Log in as `admin` (`SevaAdmin@2026#Secure`). Verify departments list, personnel count, and audit trail.
- [ ] **4. Personnel Pass Application:**  
  Log in as `priya.sharma` (`Member@2026`). Submit a journey pass request for Western Command.
- [ ] **5. Department Head Review & Ed25519 Signing:**  
  Log in as `head.western` (`HeadWestern@2026`). Review the submitted request, approve it, and confirm the Ed25519 signature is generated.
- [ ] **6. Digital Pass & Dynamic QR Code:**  
  Switch back to `priya.sharma` -> View the approved pass with high-contrast QR code.
- [ ] **7. Public QR Verification:**  
  Open the Public Verification portal (`/verify`) in an incognito window. Scan or enter the pass code. Confirm the verification returns `VALID` with verified cryptographic signature and redacted PII.
- [ ] **8. Tamper & Expiry Detection:**  
  Test verification with the expired demo pass (`SEVA-2026-WC-3341`) and revoked pass (`SEVA-2026-NC-7765`) to demonstrate fraud detection on the presentation screen.
