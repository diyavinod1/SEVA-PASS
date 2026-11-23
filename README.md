# SEVA PASS
### Secure Electronic Verification and Authorisation for Military Toll Exemptions

---

## 1. Executive Summary & Product Vision

**SEVA PASS** is a centralised digital pass issuance, departmental approval, and toll-plaza verification platform for authorised military vehicle movements.

It replaces fragile paper slips, static laminated cards, and unverified journey orders with an institutional, cryptographically verified digital service:

- **Asymmetric Cryptographic Signatures (Ed25519 / RFC 8032)**: Every issued pass is signed with the authorised issuer's private signing key. Public verification requires only the trusted public key, enabling instant offline and online validation.
- **Universal Single Login**: A single, clean login entry point for all account tiers without role selectors. The backend strictly determines authority from trusted server records.
- **Departmental Isolation & Anti-IDOR Architecture**: Department heads are cryptographically and logically isolated to their assigned command formations. Cross-department approvals or inspection attempts are blocked with HTTP 403 Forbidden.
- **Privacy-Preserving Public QR Verification**: Anyone (including toll operators and the public) can verify a pass by optical camera scan, image upload, or reference code without logging in. Personal identifiers (service numbers, phone numbers, passwords) are strictly redacted.
- **Statutory Toll Exemption Legal Ground**: Passes explicitly enforce and record legal grounds under *Section 3(1)(a) of the Indian Tolls (Army and Air Force) Act 1901*.
- **Append-Only Immutable Audit Trail**: All security events, account creations, department assignments, applications, reviews, revocations, and scans are logged with actor details and timestamps.

> **Prototype Demonstration Notice**: SEVA PASS is a prototype demonstrating a proposed authorisation and toll-plaza verification workflow. It does not claim official government endorsement or active military integration. A generated pass does not independently establish a legal toll exemption; actual exemption eligibility is governed by statutory law and official command movement orders.

---

## 2. Visual Identity & Design System

The platform has been rebuilt from the ground up with a cohesive, modern enterprise design system:

### Palette
| Swatch | Color Name | Hex Code | Purpose |
| :--- | :--- | :--- | :--- |
| ![#14243A](https://via.placeholder.com/15/14243A/000000?text=+) | **Deep Navy** | `#14243A` | Primary brand headers, hero sections, key action buttons |
| ![#0C1728](https://via.placeholder.com/15/0C1728/000000?text=+) | **Darker Navy** | `#0C1728` | Footer, high-contrast dark accents |
| ![#F7F7F3](https://via.placeholder.com/15/F7F7F3/000000?text=+) | **Warm Off-White** | `#F7F7F3` | Page canvas background, input containers |
| ![#FFFFFF](https://via.placeholder.com/15/FFFFFF/000000?text=+) | **Pure White** | `#FFFFFF` | Surface cards, tables, modal containers |
| ![#B99A62](https://via.placeholder.com/15/B99A62/000000?text=+) | **Muted Gold** | `#B99A62` | Brand accents, key badges, verification indicators |
| ![#64748B](https://via.placeholder.com/15/64748B/000000?text=+) | **Soft Slate** | `#64748B` | Secondary labels, metadata, captions |
| ![#16865A](https://via.placeholder.com/15/16865A/000000?text=+) | **Success Green** | `#16865A` | Valid pass badges, approval confirmations |
| ![#C44747](https://via.placeholder.com/15/C44747/000000?text=+) | **Error Red** | `#C44747` | Revocation notices, security alerts |

### Typography & Layout Rules
- **Font**: Plus Jakarta Sans & Inter with JetBrains Mono for alphanumeric reference codes.
- **Generous Whitespace & Alignment**: High-contrast, clean editorial hierarchy without excessive gradients, glassmorphism, or military camouflage graphics.
- **Icons**: Lucide icons exclusively (zero emojis as interface icons).

---

## 3. Account Roles & Synthetic Demonstration Directory

| Role Tier | Username / Email | Password | Preloaded Evaluation State |
| :--- | :--- | :--- | :--- |
| **Central Administrator** | `admin`<br>`admin@sevapass.internal` | `SevaAdmin@2026#Secure` | Full governance, department creation, head provisioning, platform-wide analytics and audit trail. |
| **Department Head (Western Command)** | `head.western`<br>`head.western@sevapass.internal` | `HeadWestern@2026` | Reviews journey applications for Western Command, issues Ed25519 digital passes. |
| **Department Head (Northern Command)** | `head.northern`<br>`head.northern@sevapass.internal` | `HeadNorthern@2026` | Reviews Northern Command transit applications. |
| **Personnel (Major Priya Sharma)** | `priya.sharma`<br>`priya.sharma@sevapass.internal` | `Member@2026` | Holds active verified pass (`SEVA-2026-WC-1045`) for Staff SUV `21D 104523X`. |
| **Personnel (Lt. Col. Arvind Deshmukh)** | `arvind.deshmukh`<br>`arvind.deshmukh@sevapass.internal` | `Member@2026` | Holds pending application under Northern Command. |

> **1-Click Demo Credentials Drawer**: A convenient floating drawer is available in the bottom-right corner of the interface to test any account tier with a single click.

---

## 4. Five Core Application Interfaces

### 1. Public Homepage
- Plain-language service explanation ("Pass authorisation. Simplified.") without technical jargon.
- Clear 4-step visual explanation: Submit request → Department reviews → Approved pass is generated → Pass is verified at toll plaza.
- Direct pass verification search bar and camera trigger without logging in.

### 2. Personnel Portal
- Guided 4-step pass application wizard (Personnel Details → Vehicle Information → Journey Corridor & Timing → Summary & Confirmation).
- Live application tracker with status tabs (`All`, `Pending`, `Approved`, `Rejected`).
- Current Passes tab with print/download view, high-density QR code, and validity countdown.
- Pass history archive for past or cancelled movements.

### 3. Department Head Portal
- Strictly isolated to the officer's command formation.
- Live database-computed statistics (Personnel roll, pending approvals, approved passes, rejected requests).
- Application Review modal:
  - Review applicant details, vehicle classification, route corridor, and statutory basis.
  - Approve action generates the real Ed25519 cryptographic signature.
  - Reject action strictly requires a mandatory justification.

### 4. Central Administrator Portal
- Platform-wide database statistics computed dynamically from records (never hardcoded).
- Department provisioning wizard: creates formation, generates unique username, creates strong temporary password, and displays initial credentials securely only once.
- Department activation/deactivation and head password reset.
- Pass applications registry, issued passes registry, toll verification logs, and immutable audit logs.

### 5. Public QR Verification Terminal
- Accessible from the homepage without an account.
- Camera-based optical scanner (`html5-qrcode`) with permission explanation and loading states.
- Image file upload alternative.
- Manual 16-character reference code input.
- 7-Point Cryptographic & Policy Audit:
  1. Registry existence check
  2. Ed25519 signature verification against public key
  3. Movement validity window expiry check
  4. Revocation status check
  5. Optical vehicle plate cross-matching
  6. Statutory exemption ground validation
  7. Logging of verification event without exposing PII.

---

## 5. Quick Start Instructions

### Prerequisites
- Python 3.10+ (tested with Python 3.15)
- Node.js 18+ & npm

### One-Command Full Stack Startup
```bash
chmod +x start_all.sh
./start_all.sh
```

### Manual Service Startup

#### 1. Backend Service
```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python3 -m app.seed
./venv/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- API Documentation: `http://127.0.0.1:8000/docs`
- Health Endpoint: `http://127.0.0.1:8000/api/health`

#### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
- Web Application: `http://localhost:5173`

---

## 6. Automated Verification Test Suite

Run the full backend integration and security test suite:

```bash
cd backend
./venv/bin/python3 -m pytest tests/
```

Test coverage includes:
1. `test_universal_login_all_roles`: Single login entry across all 3 roles with backend role redirection.
2. `test_personnel_registration`: Validates required fields, prevents duplicate usernames and duplicate service IDs.
3. `test_personnel_pass_application_lifecycle`: Multi-step submission and retrieval.
4. `test_department_head_approval_and_ed25519_issuance`: Department head review and asymmetric signature generation.
5. `test_cross_department_isolation`: Verifies that Western Command Head cannot approve Northern Command requests (HTTP 403 Forbidden).
6. `test_rejection_requires_reason`: Confirms that rejecting an application strictly requires a recorded reason.
7. `test_public_qr_verification_scenarios`:
   - Valid pass verification with PII redaction.
   - Expired pass detection (`EXPIRED`).
   - Revoked pass detection (`REVOKED`).
   - Tampered payload signature check failure (`INVALID`).
   - Observed vehicle mismatch check (`VEHICLE_MISMATCH`).
8. `test_pass_revocation_lifecycle`: Revocation by authorized officer and subsequent verification status change.
9. `test_central_admin_metrics`: Database-derived platform statistics verification.
