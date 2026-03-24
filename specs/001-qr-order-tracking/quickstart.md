# Quickstart: QR Order Tracking System

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier sufficient for MVP)

## Setup

### 1. Create Supabase Project

1. Go to Supabase Dashboard and create a new project
2. Note the **Project URL** and **anon/public key** from Settings > API
3. Open SQL Editor and run the schema from `specs/001-qr-order-tracking/contracts/supabase-schema.sql`

### 2. Initialize Project

```bash
npm create vite@latest . -- --template react
npm install
npm install @supabase/supabase-js html5-qrcode react-router-dom recharts
npm install -D tailwindcss @tailwindcss/vite
```

### 3. Configure Environment

Create `.env` in project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_DEFAULT_BRANCH=riyadh-01
VITE_READY_TIMEOUT_MINUTES=5
VITE_SCAN_COOLDOWN_MS=2000
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Access Pages

- **Display**: http://localhost:5173/display?branch=riyadh-01
- **Scanner**: http://localhost:5173/scan?branch=riyadh-01 (use phone on same network, or ngrok)
- **Analytics**: http://localhost:5173/analytics
- **Admin**: http://localhost:5173/admin

## Testing

```bash
# Unit + component tests
npm run test

# E2E tests
npm run test:e2e
```

## Build & Deploy

```bash
npm run build
# Output in dist/ — deploy to Vercel, Netlify, or any static hosting
```

## Branch Setup

Each restaurant branch needs two URLs configured:
- TV Display: `https://your-domain.com/display?branch=BRANCH_CODE`
- Staff Scanner: `https://your-domain.com/scan?branch=BRANCH_CODE`

Use the Admin page (`/admin`) to add new branches, or insert directly via Supabase SQL Editor.
