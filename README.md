# Glob Fabrication ERP - Web Version

A complete multi-tenant web ERP for fabrication/manufacturing businesses in India (GST compliant).

**Organization:** Glob Fabrication and Enterprises (Maharashtra, GSTIN: 27AWAPK1209R1ZC)

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Docker)

### Option 1: With Docker (Recommended)

```bash
# Clone the repo
git clone <your-repo-url>
cd erp-web

# Start all services
docker-compose up -d

# Run migrations & seed
docker-compose exec backend npx knex migrate:latest --knexfile knexfile.js
docker-compose exec backend npx knex seed:run --knexfile knexfile.js

# Access:
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000/api/health
```

### Option 2: Without Docker

```bash
# 1. Start PostgreSQL (install locally or use cloud)

# 2. Backend setup
cd backend
cp .env.example .env
# Edit .env with your database URL
npm install
npx knex migrate:latest --knexfile knexfile.js
npx knex seed:run --knexfile knexfile.js
npm run dev

# 3. Frontend setup (in new terminal)
cd frontend
npm install
npm run dev

# Access: http://localhost:5173
```

### Default Login
- **Email:** admin@globfabrication.com
- **Password:** admin123

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Backend | Node.js 18 + Express |
| Database | PostgreSQL 15 (via Knex.js) |
| Auth | JWT + bcryptjs |
| Charts | Recharts |
| Icons | Lucide React |
| Animations | Framer Motion |
| PDF | Puppeteer (server-side) |
| Excel | SheetJS (xlsx) |

---

## Features

- ✅ **GST Invoices** - Auto CGST/SGST/IGST based on state codes
- ✅ **Quotations** - Exact A4 print format with bold toggle
- ✅ **Customer Management** - Offline GSTIN parser
- ✅ **Purchase Bills** - Input GST tracking
- ✅ **GST Reports** - GSTR-1, GSTR-2, GSTR-3B
- ✅ **Dashboard** - Revenue metrics, charts, GST summary
- ✅ **GST Calculator** - Floating calculator button
- ✅ **Excel Export** - Invoices, Customers, Purchases, Payments
- ✅ **Multi-tenant** - Organization-based data isolation
- ✅ **Multi-user** - Role-based access (Admin, Accountant, Viewer)
- ✅ **Print Layout** - Configurable letterhead/footer/font size
- ✅ **Number to Words** - Indian format (Lakh/Crore)
- ✅ **Financial Year** - April-March FY format
- ✅ **Refresh App Button** - Recover from stuck states
- ✅ **Responsive Design** - Mobile-friendly
- ✅ **Audit Logging** - All mutations tracked
- ✅ **Security** - Helmet, CORS, rate limiting, parameterized queries

---

## Deployment (Free Options)

### Database: Supabase (Free Tier)
1. Create project at supabase.com
2. Copy connection string
3. Run migrations: `npx knex migrate:latest`

### Backend: Railway (Free Tier)
1. Push to GitHub
2. Connect Railway
3. Set env vars (DATABASE_URL, JWT_SECRET, etc.)
4. Custom domain: api.globfabrication.com

### Frontend: Vercel (Free Tier)
1. Push to GitHub
2. Connect Vercel
3. Set VITE_API_URL
4. Custom domain: erp.globfabrication.com

### Alternative Free Hosting
- **Backend:** Render.com, Fly.io
- **Frontend:** Netlify, Cloudflare Pages
- **Database:** Neon.tech, ElephantSQL

---

## Project Structure

```
/erp-web
├── /frontend          # React + Vite + Tailwind
│   ├── /src
│   │   ├── /pages     # All page components
│   │   ├── /components  # Sidebar, TopBar, modals
│   │   ├── /api       # Axios client
│   │   ├── /context   # Auth context
│   │   ├── /layouts   # Main layout
│   │   ├── /utils     # numberToWords, GSTIN parser, etc.
│   │   └── App.jsx
│   └── package.json
│
├── /backend           # Express + Knex + PostgreSQL
│   ├── /src
│   │   ├── /routes    # All API routes
│   │   ├── /middleware  # Auth, audit log, error handler
│   │   ├── /config    # DB, env config
│   │   ├── /migrations  # Database schema
│   │   ├── /seeds     # Seed data
│   │   └── server.js
│   ├── knexfile.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

### Auth (Public)
- `POST /api/auth/register` - Create organization + admin
- `POST /api/auth/login` - Login, returns JWT
- `POST /api/auth/forgot-password` - Generate OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/reset-password` - Reset password

### Auth (Protected)
- `GET /api/auth/me` - Current user + org
- `POST /api/auth/change-password`
- `GET /api/auth/users` - List org users
- `POST /api/auth/users` - Add user

### Business
- CRUD: `/api/customers`, `/api/invoices`, `/api/quotations`, `/api/purchases`
- `/api/invoices/:id/full` - Full update with items
- `/api/quotations/:id/convert` - Convert to invoice
- PDF: `/api/invoices/:id/pdf`, `/api/quotations/:id/pdf`

### Reports & Analytics
- `GET /api/dashboard/stats`
- `GET /api/gst/summary?year=2026`
- `GET /api/reports/item-wise-sales`
- `GET /api/reports/customer-wise-sales`
- `GET /api/reports/ageing`
- `GET /api/export/invoices.xlsx` (and others)

---

## Business Logic

### Invoice Number Format
`{prefix}{nextId}/{FY}` → e.g., `GST-0001/26-27`

### Financial Year
- April 2026 → `26-27`
- January 2027 → `26-27`
- April 2027 → `27-28`

### GST Calculation
- Same state (intra): CGST + SGST (split 50/50)
- Different state (inter): IGST (full rate)
- State code derived from GSTIN first 2 characters

### Quotation Customer Storage
```
notes = "Customer Name|||PAN/Vehicle Info|||Actual Notes"
```

---

## License

Private - Glob Fabrication and Enterprises
