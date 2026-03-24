# Tasks: QR Order Tracking System

**Input**: Design documents from `/specs/001-qr-order-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and build configuration

- [x] T001 Initialize React project with Vite: `npm create vite@latest . -- --template react` and install dependencies (`@supabase/supabase-js`, `html5-qrcode`, `react-router-dom`, `recharts`, `tailwindcss`, `@tailwindcss/vite`) per quickstart.md
- [x] T002 Configure Tailwind CSS with RTL support and Cairo Arabic font in `src/index.css` — set `dir="rtl"` on root HTML element in `index.html`, import Cairo from Google Fonts
- [x] T003 [P] Create environment configuration with `.env.example` listing all VITE_ variables per contracts/routes.md (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_DEFAULT_BRANCH, VITE_READY_TIMEOUT_MINUTES, VITE_SCAN_COOLDOWN_MS)
- [x] T004 [P] Initialize Supabase client in `src/lib/supabase.js` — create and export the Supabase client using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, routing, shared utilities and hooks that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create database migration `supabase/migrations/001_create_branches.sql` — branches table with id, name_ar, name_en, code (unique), location_label, is_active, created_at per data-model.md
- [x] T006 [P] Create database migration `supabase/migrations/002_create_orders.sql` — orders table with id, order_id, branch_id (FK), channel_link, status (check constraint), scanned_at, ready_at, completed_at, prep_duration_seconds (generated), raw_qr_data, created_at, unique(order_id, branch_id) per data-model.md
- [x] T007 [P] Create database migration `supabase/migrations/003_create_scan_logs.sql` — scan_logs table with id, order_id (FK), scan_type (check constraint), scanned_by, scanned_at, device_info per data-model.md
- [x] T008 Create database migration `supabase/migrations/004_rls_policies.sql` — enable RLS on all tables, add open policies per contracts/supabase-schema.sql, enable realtime publication on orders table
- [x] T009 Create database migration `supabase/migrations/005_seed_branches.sql` — seed 3 initial branches (Erqaa-01, Laban-02, AlMalqa-03) with Arabic and English names per data-model.md
- [x] T010 Setup React Router in `src/App.jsx` — configure routes for /display (DisplayDashboard), /scan (Scanner), /analytics (Analytics), /admin (Admin) per contracts/routes.md, with a default redirect to /display
- [x] T011 [P] Implement `src/utils/parseQR.js` — parse QR JSON payload extracting order_id, channel_link, location; fallback to raw text as order_id if JSON parsing fails per contracts/qr-payload.md
- [x] T012 [P] Implement `src/utils/formatTime.js` — utility functions for formatting elapsed time (e.g., "3m 45s"), formatting duration in seconds, and formatting Arabic date/time for display header
- [x] T013 [P] Implement `src/hooks/useBranch.js` — resolve branch from URL query parameter (?branch=CODE) using useSearchParams, fetch branch record from Supabase by code, handle missing/invalid branch with error state, fallback to VITE_DEFAULT_BRANCH

**Checkpoint**: Foundation ready — database schema deployed, router configured, shared utilities available. User story implementation can now begin.

---

## Phase 3: User Story 1 — Kitchen Staff Scans New Order (Priority: P1) MVP

**Goal**: Kitchen staff can scan a QR code from a POS receipt and create a new order with "Preparing" status in the system.

**Independent Test**: Open /scan?branch=riyadh-01 on a phone, scan a QR code, verify order appears in the database with status "preparing" and a scan_log entry is created.

### Implementation for User Story 1

- [x] T014 [US1] Implement `src/hooks/useScanner.js` — handleScan function: parse QR data, check if order exists for branch (supabase select), if not found INSERT new order with status='preparing' and log to scan_logs as 'first_scan'; include 2-second cooldown state management using VITE_SCAN_COOLDOWN_MS
- [x] T015 [US1] Implement `src/components/ScannerView.jsx` — camera viewfinder using html5-qrcode library, animated scan line overlay, corner bracket decorations, onScan callback integration with useScanner hook
- [x] T016 [US1] Implement `src/pages/Scanner.jsx` — mobile-optimized scanner page: integrate ScannerView, useBranch for branch resolution, success/error feedback with green checkmark pulse animation and haptic vibration (navigator.vibrate), scan history list showing last 10 scans below the viewfinder, cooldown indicator

**Checkpoint**: First scan creates orders. Scanner page is functional on mobile. Core data flow works.

---

## Phase 4: User Story 2 — Real-Time Display Dashboard (Priority: P1)

**Goal**: Wall-mounted TV displays all active orders for a branch in real-time with two columns (Preparing/Ready), notification sounds, and live clock.

**Independent Test**: Open /display?branch=riyadh-01 on a TV browser, insert an order via the scanner (or directly in Supabase), verify it appears in the Preparing column within 1 second with a sound notification.

### Implementation for User Story 2

- [x] T017 [P] [US2] Implement `src/hooks/useOrders.js` — subscribe to Supabase Realtime on orders table filtered by branch_id, handle INSERT (add to list), UPDATE (update in list), DELETE (remove from list); initial fetch of preparing/ready orders; return { orders, preparing, ready }
- [x] T018 [P] [US2] Implement `src/hooks/useSound.js` — preload notification.mp3 using Web Audio API, expose play() function, handle autoplay policy by requiring initial user interaction on page load
- [x] T019 [P] [US2] Add notification sound file `public/notification.mp3` — short, clear notification chime suitable for kitchen environment
- [x] T020 [US2] Implement `src/components/OrderCard.jsx` — display order_id (bold, large font min 2rem), channel source extracted from channel_link, elapsed time since scanned_at using formatTime, dark semi-transparent card with status-appropriate accent color (orange for preparing, green for ready), RTL layout
- [x] T021 [P] [US2] Implement `src/components/PreparingColumn.jsx` — column header "قيد التحضير" (Preparing) with orange accent (#f59e0b), renders list of OrderCards for orders with status='preparing', slide-in animation for new orders
- [x] T022 [P] [US2] Implement `src/components/ReadyColumn.jsx` — column header "جاهز" (Ready) with green accent (#10b981), renders list of OrderCards for orders with status='ready', smooth transition animation for orders arriving from Preparing
- [x] T023 [US2] Implement `src/pages/DisplayDashboard.jsx` — full-screen dark theme (#0a0e1a) dashboard: header with branch name (Arabic), live digital clock (update every second), active order count; two-column layout with PreparingColumn and ReadyColumn; integrate useOrders, useBranch, useSound (play on new INSERT); auto-refresh elapsed time every 10 seconds; empty state when no orders; RTL direction

**Checkpoint**: Display shows orders in real-time, plays sounds, shows clock. Core kitchen workflow is visible.

---

## Phase 5: User Story 3 — Staff Marks Order as Ready (Priority: P1)

**Goal**: Second scan of the same QR code transitions order from Preparing to Ready, with prep duration auto-calculated. Duplicate scans are handled gracefully.

**Independent Test**: Scan a QR code once (order enters Preparing), scan it again (order moves to Ready on display), scan it a third time (scanner shows "already ready" message).

### Implementation for User Story 3

- [x] T024 [US3] Extend `src/hooks/useScanner.js` — add second-scan logic: if order exists with status='preparing', UPDATE to status='ready' with ready_at=now(), log 'second_scan' to scan_logs; if order already 'ready' or 'completed', return 'already_done' action
- [x] T025 [US3] Update `src/pages/Scanner.jsx` — add visual feedback for all scan outcomes: green checkmark for 'created' (new order), blue checkmark for 'ready' (order completed), yellow warning for 'already_done' with message "الطلب جاهز بالفعل" (Order already marked as ready); display the action result prominently after each scan

**Checkpoint**: Full scan lifecycle works (first scan → preparing, second scan → ready, third scan → already done). Prep duration calculated automatically via database computed column.

---

## Phase 6: User Story 4 — Completed Orders Auto-Clear (Priority: P2)

**Goal**: Orders in "Ready" status automatically fade out and are removed from the display after a configurable timeout (default 5 minutes).

**Independent Test**: Mark an order as ready, wait 5 minutes (or reduce timeout for testing), verify the order fades out from the display and its status updates to "completed" in the database.

### Implementation for User Story 4

- [x] T026 [US4] Add auto-clear timer logic to `src/pages/DisplayDashboard.jsx` — for each order with status='ready', track elapsed time since ready_at; when VITE_READY_TIMEOUT_MINUTES expires, update order status to 'completed' with completed_at=now() via Supabase; add CSS fade-out animation (opacity transition) before removal
- [x] T027 [US4] Add fade-out animation styles in `src/index.css` — CSS transition for order cards fading out (opacity 1→0 over 500ms) before being removed from the DOM

**Checkpoint**: Display auto-cleans completed orders. Dashboard stays focused on active work.

---

## Phase 7: User Story 5 — Analytics and Reporting (Priority: P2)

**Goal**: Management dashboard showing prep time statistics, branch comparison charts, date filtering, and CSV export.

**Independent Test**: With completed orders in the database, open /analytics, verify KPI cards show correct aggregated data, charts render, date/branch filters work, and CSV exports successfully.

### Implementation for User Story 5

- [x] T028 [P] [US5] Implement `src/components/StatsCard.jsx` — reusable KPI card component displaying a label, value, and optional unit (e.g., "Average Prep Time" / "4m 32s"), styled for the analytics dashboard
- [x] T029 [P] [US5] Implement `src/components/BranchSelector.jsx` — dropdown component that fetches all active branches from Supabase, includes "All Branches" option, emits selected branch_id on change
- [x] T030 [US5] Implement `src/pages/Analytics.jsx` — analytics dashboard with: date range filter (today, last 7 days, last 30 days, custom date picker); BranchSelector for branch filtering; 4 KPI StatsCards (total orders, avg prep time, fastest, slowest); bar chart using Recharts showing avg prep time per branch; line chart using Recharts showing orders per hour; detailed order log table (order_id, branch, channel, scanned_at, ready_at, prep_duration); CSV export button that generates and downloads a CSV from the filtered table data; all data fetched from Supabase orders table where status='completed' and prep_duration_seconds is not null

**Checkpoint**: Analytics fully functional with filtering, charts, and export.

---

## Phase 8: User Story 6 — Multi-Branch Support (Priority: P2)

**Goal**: System correctly isolates orders per branch and supports branch auto-detection from QR location data.

**Independent Test**: Set up two branches, scan orders at each using different ?branch= URLs, verify each display only shows its own orders. Test QR with "location" field matching a branch.

### Implementation for User Story 6

- [x] T031 [US6] Extend `src/hooks/useBranch.js` — add location auto-detection: accept optional location string from QR data, query Supabase branches where location_label matches, use matched branch if URL param is missing; add error UI state for invalid/unknown branch code with user-friendly message
- [x] T032 [US6] Update `src/pages/Scanner.jsx` and `src/pages/DisplayDashboard.jsx` — add error boundary for invalid branch: display Arabic error message "الفرع غير موجود" (Branch not found) with instruction to check the URL; prevent scanner/display from operating without a valid branch

**Checkpoint**: Multi-branch isolation verified. Branch auto-detection from QR works.

---

## Phase 9: User Story 7 — PWA Installation on Mobile (Priority: P3)

**Goal**: Scanner app is installable on phone home screen as a Progressive Web App.

**Independent Test**: Open /scan on a mobile device, verify browser shows "Add to Home Screen" prompt, install and launch from home screen in standalone mode.

### Implementation for User Story 7

- [x] T033 [P] [US7] Create `public/manifest.json` — PWA manifest with app name "QR Order Tracker" (Arabic: "متتبع الطلبات"), short_name, start_url "/scan", display "standalone", theme_color "#0a0e1a", background_color "#0a0e1a", icons (generate 192x192 and 512x512 app icons)
- [x] T034 [P] [US7] Create `public/sw.js` — minimal service worker that caches static assets (HTML, CSS, JS, fonts) for faster loading; no offline data sync needed; activate and claim clients on install
- [x] T035 [US7] Register service worker in `src/main.jsx` — register sw.js on app load, add `<link rel="manifest">` to index.html

**Checkpoint**: PWA installable on Android/iOS. Scanner launches from home screen.

---

## Phase 10: User Story 8 — Branch Administration (Priority: P3)

**Goal**: Admin page for managing branches (add, edit, activate/deactivate) without direct database access.

**Independent Test**: Open /admin, add a new branch, verify it appears in the branch list and becomes available for scanner/display URLs.

### Implementation for User Story 8

- [x] T036 [US8] Implement `src/pages/Admin.jsx` — branch management page: table listing all branches (name_ar, name_en, code, location_label, is_active status); "Add Branch" form with fields for all branch attributes; edit inline or modal for existing branches; activate/deactivate toggle per branch; all CRUD operations via Supabase client; RTL layout with Arabic labels

**Checkpoint**: Branch management available via UI. Non-technical admins can manage branches.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [x] T037 Add global error handling in `src/App.jsx` — React error boundary wrapping all routes, user-friendly Arabic error message with retry option
- [x] T038 [P] Add empty states for all pages — display dashboard ("لا توجد طلبات نشطة"), scanner ("مسح رمز QR للبدء"), analytics ("لا توجد بيانات للفترة المحددة")
- [x] T039 [P] Add loading states for all pages — skeleton loaders or spinner while branch data and initial orders are being fetched
- [x] T040 Responsive layout verification — ensure display dashboard scales well on common TV resolutions (1080p, 4K), scanner works on various mobile screen sizes, analytics is usable on tablet/desktop
- [x] T041 Run quickstart.md validation — follow quickstart.md end-to-end on a clean setup, verify all steps work, fix any discrepancies

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2)
- **US2 (Phase 4)**: Depends on Foundational (Phase 2), can run in parallel with US1
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — extends useScanner.js
- **US4 (Phase 6)**: Depends on US2 (Phase 4) — extends DisplayDashboard.jsx
- **US5 (Phase 7)**: Depends on Foundational (Phase 2), can run in parallel with US1-US4
- **US6 (Phase 8)**: Depends on US1 (Phase 3) and US2 (Phase 4) — extends useBranch, Scanner, Display
- **US7 (Phase 9)**: Depends on Setup (Phase 1) only — independent PWA files
- **US8 (Phase 10)**: Depends on Foundational (Phase 2) only — standalone admin page
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) ──> Phase 2 (Foundational) ──┬──> Phase 3 (US1: Scan) ──> Phase 5 (US3: Ready)
                                              │                      └──> Phase 8 (US6: Multi-Branch)
                                              ├──> Phase 4 (US2: Display) ──> Phase 6 (US4: Auto-Clear)
                                              │                         └──> Phase 8 (US6: Multi-Branch)
                                              ├──> Phase 7 (US5: Analytics)
                                              ├──> Phase 9 (US7: PWA)
                                              └──> Phase 10 (US8: Admin)
                                                                          ──> Phase 11 (Polish)
```

### Parallel Opportunities

**After Phase 2 completes, these can run in parallel:**
- US1 (Scanner) and US2 (Display) — different pages, different hooks
- US5 (Analytics) — completely independent page
- US7 (PWA) — just static files, no code dependencies
- US8 (Admin) — standalone page

**Within User Story 2:**
- T017, T018, T019 (useOrders, useSound, notification.mp3) — all in parallel
- T021, T022 (PreparingColumn, ReadyColumn) — parallel, different files

**Within User Story 5:**
- T028, T029 (StatsCard, BranchSelector) — parallel components

---

## Parallel Example: After Phase 2

```
# These 4 streams can all run simultaneously:
Stream A: T014 → T015 → T016 (US1: Scanner)
Stream B: T017+T018+T019 → T020 → T021+T022 → T023 (US2: Display)
Stream C: T033+T034 → T035 (US7: PWA)
Stream D: T036 (US8: Admin)

# After Streams A+B complete:
Stream E: T024 → T025 (US3: Ready - extends US1)
Stream F: T026 → T027 (US4: Auto-Clear - extends US2)
Stream G: T031 → T032 (US6: Multi-Branch - extends US1+US2)

# Independent anytime after Phase 2:
Stream H: T028+T029 → T030 (US5: Analytics)
```

---

## Implementation Strategy

### MVP First (User Stories 1+2+3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Scanner creates orders
4. Complete Phase 4: US2 — Display shows orders in real-time
5. Complete Phase 5: US3 — Second scan marks ready
6. **STOP and VALIDATE**: Full scan-to-ready workflow works end-to-end
7. Deploy/demo if ready — this is a functional MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 + US3 → Core workflow (MVP!)
3. US4 → Auto-clear keeps display clean
4. US5 → Analytics for management
5. US6 → Multi-branch verification
6. US7 + US8 → PWA + Admin polish
7. Polish phase → Error handling, loading states, responsive

### Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The database computed column `prep_duration_seconds` handles US3's duration calculation automatically — no application code needed
