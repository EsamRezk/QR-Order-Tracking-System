# Implementation Plan: QR Order Tracking System

**Branch**: `001-qr-order-tracking` | **Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-qr-order-tracking/spec.md`

## Summary

Build a real-time QR-based order tracking system for a multi-branch restaurant chain. Kitchen staff scan QR codes from Foodics POS receipts to track order preparation status. The system consists of three components: a mobile QR scanner (PWA), a wall-mounted display dashboard, and an analytics reporting page — all backed by Supabase for database, auth, and real-time subscriptions.

## Technical Context

**Language/Version**: JavaScript (ES2022+), React 18, Node.js 18+
**Primary Dependencies**: React 18, Vite 5, Tailwind CSS 3, Supabase JS Client v2, html5-qrcode, React Router v6, Recharts
**Storage**: Supabase (PostgreSQL) — managed cloud database with real-time subscriptions
**Testing**: Vitest (unit tests), React Testing Library (component tests), Playwright (E2E)
**Target Platform**: Web (PWA) — mobile browsers for scanner, desktop/TV browsers for display
**Project Type**: Single-page web application (SPA) with PWA capabilities
**Performance Goals**: Real-time updates within 1 second, display readable from 3+ meters, analytics load within 3 seconds
**Constraints**: RTL (Arabic-first) layout, offline not required for MVP, no authentication for MVP
**Scale/Scope**: 10 concurrent branches, tens to hundreds of orders per branch per day, 4 pages (display, scanner, analytics, admin)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is unpopulated (template only). No gates to enforce. Proceeding with standard best practices:
- Simple project structure (single SPA, no unnecessary abstractions)
- Test coverage for critical paths (scan logic, real-time updates)
- Clear separation of concerns (pages, components, hooks, utils)

## Project Structure

### Documentation (this feature)

```text
specs/001-qr-order-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
public/
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker
└── notification.mp3       # Notification sound file

src/
├── main.jsx               # App entry point
├── App.jsx                # Router setup
├── lib/
│   └── supabase.js        # Supabase client initialization
├── pages/
│   ├── DisplayDashboard.jsx   # TV display page (/display)
│   ├── Scanner.jsx            # Mobile QR scanner page (/scan)
│   ├── Analytics.jsx          # Reporting dashboard (/analytics)
│   └── Admin.jsx              # Branch management (/admin)
├── components/
│   ├── OrderCard.jsx          # Single order card (used in both columns)
│   ├── PreparingColumn.jsx    # "Preparing" orders column
│   ├── ReadyColumn.jsx        # "Ready" orders column
│   ├── ScannerView.jsx        # Camera viewfinder + scan UI
│   ├── BranchSelector.jsx     # Branch dropdown for analytics/admin
│   └── StatsCard.jsx          # KPI card for analytics
├── hooks/
│   ├── useOrders.js           # Real-time order subscription + state
│   ├── useScanner.js          # Scan handler logic (first/second scan)
│   ├── useBranch.js           # Branch resolution from URL/QR
│   └── useSound.js            # Notification sound playback
└── utils/
    ├── parseQR.js             # QR JSON parser with fallback
    └── formatTime.js          # Elapsed time / duration formatting

supabase/
└── migrations/
    ├── 001_create_branches.sql
    ├── 002_create_orders.sql
    ├── 003_create_scan_logs.sql
    ├── 004_rls_policies.sql
    └── 005_seed_branches.sql

tests/
├── unit/
│   ├── parseQR.test.js
│   ├── formatTime.test.js
│   └── useScanner.test.js
├── component/
│   ├── OrderCard.test.jsx
│   └── ScannerView.test.jsx
└── e2e/
    ├── scan-flow.spec.js
    └── display-realtime.spec.js
```

**Structure Decision**: Single SPA with React Router. No backend directory needed — Supabase handles all server-side concerns (database, auth, real-time). SQL migrations kept in `supabase/migrations/` for version control. Tests organized by type (unit, component, e2e).

## Complexity Tracking

No constitution violations to justify. The project is a straightforward single SPA with a managed backend (Supabase), matching the simplest viable architecture for the requirements.
