# Research: QR Order Tracking System

**Date**: 2026-03-23 | **Branch**: `001-qr-order-tracking`

## 1. QR Code Scanning Library

**Decision**: html5-qrcode
**Rationale**: Lightweight, well-maintained library that wraps the browser's MediaDevices API for camera access. Supports both continuous scanning and file-based scanning. Works across mobile browsers (Chrome, Safari) without native app requirements. Active community with 4k+ GitHub stars.
**Alternatives considered**:
- `@zxing/browser`: More feature-rich but heavier bundle size. Better for barcode variety but QR-only is sufficient here.
- `jsQR`: Lower-level library requiring manual canvas handling. More work for the same result.
- Native BarcodeDetector API: Not yet supported across all mobile browsers (Safari support limited).

## 2. Real-Time Subscription Strategy

**Decision**: Supabase Realtime (Postgres Changes)
**Rationale**: Built into Supabase with zero additional infrastructure. Uses WebSocket connections. Supports filtering by column value (`branch_id=eq.{id}`), which means each display only receives events for its branch. Handles INSERT, UPDATE, DELETE events natively.
**Alternatives considered**:
- Polling: Simpler but adds latency (minimum 1-2 seconds) and wastes bandwidth. Doesn't meet the <1 second requirement.
- Custom WebSocket server: More control but requires additional infrastructure, deployment, and maintenance. Overkill for MVP.
- Server-Sent Events (SSE): One-directional, works well but Supabase doesn't support SSE natively for Postgres changes.

## 3. State Management Approach

**Decision**: React hooks (useState/useEffect) with Supabase as the source of truth
**Rationale**: The application state is simple — orders list per branch, filtered by status. Supabase Realtime provides the event-driven updates. No need for global state management libraries. Each page manages its own state through custom hooks (useOrders, useScanner, useBranch).
**Alternatives considered**:
- Zustand/Jotai: Lightweight state managers, but add unnecessary complexity when Supabase already drives state updates.
- Redux: Too heavy for this use case. No complex state interactions or middleware needs.
- React Context: Could be used for branch info sharing, but URL query params already handle this cleanly.

## 4. RTL and Arabic Typography

**Decision**: Tailwind CSS with `dir="rtl"` on root element, Cairo font from Google Fonts
**Rationale**: Tailwind has built-in RTL support via `rtl:` variant prefix. Cairo is a popular Arabic web font with excellent readability at large sizes (critical for TV display from 3+ meters). Setting `dir="rtl"` on the root element flips the entire layout automatically.
**Alternatives considered**:
- Custom CSS with logical properties (margin-inline-start, etc.): More verbose, same result.
- Material UI with RTL theme: Heavy framework dependency for what's achievable with Tailwind utilities.
- Noto Sans Arabic: Good coverage but Cairo has better readability at display sizes.

## 5. PWA Strategy

**Decision**: Manual service worker + web app manifest
**Rationale**: Minimal PWA requirements — just needs installability and standalone mode. A simple service worker for caching static assets and a manifest.json with app metadata is sufficient. No need for offline data sync (spec explicitly states offline not required for MVP).
**Alternatives considered**:
- Vite PWA Plugin (vite-plugin-pwa): Automates SW generation with Workbox. Good option but adds build complexity. Could adopt later if caching needs grow.
- No PWA: Would still work but loses the "Add to Home Screen" capability requested in the spec.

## 6. Analytics Charting Library

**Decision**: Recharts
**Rationale**: React-native charting library built on D3. Simple API with declarative components (BarChart, LineChart). Supports responsive containers for different screen sizes. Handles the two required chart types (bar chart for branch comparison, line chart for orders per hour) cleanly.
**Alternatives considered**:
- Chart.js with react-chartjs-2: More flexible but requires more configuration. Canvas-based (Recharts uses SVG which is easier to style/theme).
- Nivo: Beautiful defaults but heavier bundle. More charts than needed.
- Lightweight custom SVG: Too much effort for the chart types needed.

## 7. Routing Strategy

**Decision**: React Router v6 with query parameter-based branch selection
**Rationale**: Four routes (/display, /scan, /analytics, /admin) with branch context passed via `?branch=CODE` query parameter. This allows bookmarkable URLs per branch and easy TV/phone setup — just configure the URL once. React Router v6 provides useSearchParams hook for clean query param access.
**Alternatives considered**:
- Path-based routing (/display/riyadh-01): Cleaner URLs but harder to configure on TV browsers. Query params are easier to type/bookmark.
- No router (conditional rendering): Would work for 4 pages but loses URL-based navigation and bookmarkability.

## 8. Database Migration Management

**Decision**: SQL files in `supabase/migrations/` directory, applied via Supabase Dashboard or CLI
**Rationale**: Supabase supports migration files natively via `supabase db push` or manual execution in the SQL editor. Keeping migrations as numbered SQL files provides version control and reproducibility across environments.
**Alternatives considered**:
- Supabase Dashboard only: No version control, risky for multi-environment deployments.
- Prisma/Drizzle ORM: Adds a Node.js migration layer. Overkill when writing raw SQL for 3 tables is straightforward.

## 9. Notification Sound Playback

**Decision**: Web Audio API via a custom useSound hook
**Rationale**: Simple playback of a single MP3 notification sound when new orders arrive. Web Audio API is universally supported and doesn't require any library. The hook pre-loads the audio file and exposes a `play()` function. Autoplay policies handled by requiring user interaction on the display page first (click to start).
**Alternatives considered**:
- HTML5 Audio element: Simpler but less control over playback timing. Can have issues with rapid sequential plays.
- howler.js: Full-featured audio library. Overkill for playing a single notification sound.

## 10. Auto-Clear Timeout Implementation

**Decision**: Client-side timer on the display dashboard
**Rationale**: When an order transitions to "Ready", the display starts a countdown timer (default 5 minutes). When the timer expires, the order status is updated to "completed" in the database (setting `completed_at`), which triggers a Realtime UPDATE event that removes it from the active orders list. This approach keeps the logic simple and tied to the display that shows the orders.
**Alternatives considered**:
- Server-side cron/scheduled function: More reliable but requires Supabase Edge Functions or external scheduler. Added complexity for MVP.
- Database trigger with pg_cron: PostgreSQL extension, may not be available on all Supabase plans. Better for Phase 2.
- Client-side only (just hide, don't update DB): Loses the "completed" status tracking needed for accurate analytics.
