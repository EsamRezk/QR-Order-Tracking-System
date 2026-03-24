# Feature Specification: QR Order Tracking System

**Feature Branch**: `001-qr-order-tracking`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "Real-time QR-based order tracking system for a multi-branch restaurant chain with scanner PWA, display dashboard, and analytics"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kitchen Staff Scans New Order (Priority: P1)

A kitchen staff member receives a printed receipt from the POS system containing a QR code. They open the scanner app on their phone and scan the QR code. The order immediately appears on the kitchen display screen under "Preparing" status with a timestamp showing when it was scanned.

**Why this priority**: This is the core entry point for the entire system. Without the ability to scan a QR code and create an order, nothing else functions. This delivers the fundamental value of digitizing the order tracking process.

**Independent Test**: Can be fully tested by scanning a QR code and verifying the order appears in the system with "Preparing" status. Delivers immediate value by replacing manual order tracking.

**Acceptance Scenarios**:

1. **Given** the scanner app is open on a mobile device, **When** staff scans a valid QR code containing order data (order ID, channel, location), **Then** a new order is created with "Preparing" status and the scan is logged with a timestamp.
2. **Given** a QR code contains only an order ID (no channel or location), **When** staff scans it, **Then** the system still creates the order using the order ID and associates it with the branch from the URL.
3. **Given** a QR code contains invalid/unparseable data, **When** staff scans it, **Then** the system treats the raw text as an order ID and creates the order.
4. **Given** a scan was just completed, **When** staff accidentally scans again within 2 seconds, **Then** the system ignores the duplicate scan (cooldown period).

---

### User Story 2 - Real-Time Display Dashboard (Priority: P1)

A wall-mounted TV screen in the kitchen displays all active orders for the branch in two columns: "Preparing" (orders being worked on) and "Ready" (completed orders). The display updates in real-time as orders are scanned and their status changes. A notification sound plays when a new order appears.

**Why this priority**: The display dashboard is the primary output of the system. Kitchen staff and managers need to see order status at a glance. Without this, scanning orders provides no visible benefit to the kitchen workflow.

**Independent Test**: Can be tested by loading the display page for a branch and verifying it shows current orders in the correct columns, updates in real-time, and plays sounds for new orders.

**Acceptance Scenarios**:

1. **Given** the display is showing orders for a specific branch, **When** a new order is scanned on the scanner app, **Then** the order appears in the "Preparing" column within 1 second with an animation.
2. **Given** orders are displayed with elapsed time, **When** 10 seconds pass, **Then** the elapsed time counters refresh automatically.
3. **Given** the display is active, **When** a new order enters "Preparing", **Then** a notification sound plays.
4. **Given** the display shows the header, **Then** it includes the branch name (in Arabic), current date/time as a live clock, and the count of active orders.

---

### User Story 3 - Staff Marks Order as Ready (Priority: P1)

When a kitchen staff member finishes preparing an order, they scan the same QR code a second time. The order moves from "Preparing" to "Ready" on the display dashboard. The preparation duration is automatically calculated.

**Why this priority**: Completing the order lifecycle (preparing -> ready) is essential for the system to provide value. Without this, the system only tracks when orders start, not when they finish.

**Independent Test**: Can be tested by scanning a QR code twice - first scan creates the order, second scan marks it ready - and verifying the transition on the display.

**Acceptance Scenarios**:

1. **Given** an order exists with "Preparing" status, **When** staff scans the same QR code again, **Then** the order moves to "Ready" status and the ready timestamp is recorded.
2. **Given** an order has been marked "Ready", **When** staff scans the same QR code a third time, **Then** the system shows a message "Order already marked as ready" and takes no further action.
3. **Given** an order transitions to "Ready", **Then** the preparation duration (time between first and second scan) is automatically calculated and stored.

---

### User Story 4 - Completed Orders Auto-Clear (Priority: P2)

Orders that have been in "Ready" status for a configurable time period (default 5 minutes) automatically fade out and are removed from the display. This keeps the dashboard clean and focused on active work.

**Why this priority**: Important for usability of the display but not critical for the core scan-and-track flow. The display would still function without auto-clearing, just with growing clutter.

**Independent Test**: Can be tested by marking an order as ready and waiting for the timeout period, verifying it disappears from the display.

**Acceptance Scenarios**:

1. **Given** an order has been in "Ready" status, **When** the configured timeout period elapses (default 5 minutes), **Then** the order fades out and is removed from the display.
2. **Given** the timeout is configurable, **When** an administrator sets a different timeout value, **Then** future ready orders use the new timeout value.

---

### User Story 5 - Analytics and Reporting (Priority: P2)

Restaurant management can view an analytics dashboard showing preparation time statistics across branches. They can filter by date range and branch, view KPI summaries, compare branch performance, and export data.

**Why this priority**: Analytics provide long-term value for operational improvement but are not required for day-to-day kitchen operations. The core scanning and display functionality is independently valuable.

**Independent Test**: Can be tested by having completed orders in the system and verifying that the analytics page shows correct aggregated data, charts, and allows filtering/export.

**Acceptance Scenarios**:

1. **Given** completed orders exist in the system, **When** a manager opens the analytics page, **Then** they see KPI cards showing total orders, average prep time, fastest order, and slowest order.
2. **Given** the analytics page is open, **When** the manager selects a date range (today, last 7 days, last 30 days, or custom), **Then** all displayed data and charts filter to that range.
3. **Given** the analytics page is open, **When** the manager selects a specific branch or "all branches", **Then** data filters accordingly and branch comparison charts update.
4. **Given** analytics data is displayed, **When** the manager clicks "Export to CSV", **Then** a CSV file downloads containing the detailed order log data.

---

### User Story 6 - Multi-Branch Support (Priority: P2)

The system supports multiple restaurant branches simultaneously. Each branch has its own scanner URL and display URL. Orders are isolated per branch - scanning at one branch does not affect another branch's display.

**Why this priority**: Multi-branch support is essential for the restaurant chain but could be deferred for a single-branch pilot. However, it's architecturally important to build in from the start.

**Independent Test**: Can be tested by setting up two branches, scanning orders at each, and verifying that each branch's display only shows its own orders.

**Acceptance Scenarios**:

1. **Given** multiple branches exist in the system, **When** a QR code is scanned at Branch A, **Then** the order only appears on Branch A's display, not on any other branch's display.
2. **Given** a branch-specific scanner URL (e.g., /scan?branch=riyadh-01), **When** staff opens it, **Then** the scanner is pre-configured for that branch.
3. **Given** the QR code contains a "location" field, **When** it matches a known branch, **Then** the system can auto-detect the branch even without a URL parameter.

---

### User Story 7 - PWA Installation on Mobile (Priority: P3)

Kitchen staff can install the scanner app on their phone's home screen as a Progressive Web App. This provides quick access without opening a browser and a more native-like experience.

**Why this priority**: Nice-to-have for user experience. The scanner works perfectly in a browser; PWA installation is a convenience enhancement.

**Independent Test**: Can be tested by opening the scanner URL on a mobile device and using the "Add to Home Screen" prompt to install it, then launching from the home screen.

**Acceptance Scenarios**:

1. **Given** a user opens the scanner URL on a mobile device, **When** the PWA criteria are met, **Then** the browser shows an install prompt or the user can manually add to home screen.
2. **Given** the PWA is installed, **When** the user launches it from the home screen, **Then** it opens in standalone mode without browser chrome.

---

### User Story 8 - Branch Administration (Priority: P3)

An administrator can manage branches through an admin page - adding new branches, editing branch details, and activating/deactivating branches.

**Why this priority**: Branches can be seeded directly in the database initially. A UI for management is a convenience for non-technical administrators.

**Independent Test**: Can be tested by accessing the admin page, adding a new branch, and verifying it becomes available for scanner/display URLs.

**Acceptance Scenarios**:

1. **Given** an admin opens the branch management page, **When** they add a new branch with Arabic name, English name, code, and location, **Then** the branch is created and available for use.
2. **Given** existing branches are listed, **When** an admin deactivates a branch, **Then** it no longer appears as an option for new scanner/display sessions.

---

### Edge Cases

- What happens when the same order ID exists at two different branches? Each branch maintains its own order namespace - the same order ID can exist independently at different branches.
- What happens when the network connection drops during a scan? The scanner should show an error message and allow the staff to retry. No partial data should be created.
- What happens if the display loses its real-time connection? The display should attempt to reconnect automatically and perform a full data refresh upon reconnection.
- What happens when the QR code is damaged or partially unreadable? The scanner shows a clear error asking the staff to try again or position the QR code differently.
- What happens if multiple staff members scan the same QR code simultaneously? The unique constraint on order ID + branch prevents duplicate orders; the second insert fails gracefully and the system treats it as a second scan.
- What happens when the display has no orders? It shows an empty state with a message indicating no active orders.
- What happens if the branch code in the URL doesn't match any known branch? The display/scanner shows an error message asking the user to check the URL.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept QR code scans containing JSON data with at minimum an order ID field.
- **FR-002**: System MUST create a new order with "Preparing" status when a QR code is scanned for the first time at a branch.
- **FR-003**: System MUST transition an order from "Preparing" to "Ready" when the same QR code is scanned a second time at the same branch.
- **FR-004**: System MUST reject or ignore a third scan of the same QR code and inform the user the order is already marked as ready.
- **FR-005**: System MUST enforce a cooldown period (default 2 seconds) between scans to prevent accidental double-scans.
- **FR-006**: System MUST display orders in real-time on the dashboard, updating within 1 second of any status change.
- **FR-007**: System MUST play an audible notification sound when a new order enters "Preparing" on the display.
- **FR-008**: System MUST auto-remove orders from the display after a configurable timeout (default 5 minutes) once they reach "Ready" status.
- **FR-009**: System MUST log every scan event with timestamp, scan type (first/second), and order reference.
- **FR-010**: System MUST automatically calculate preparation duration as the time between first scan and second scan.
- **FR-011**: System MUST support the Arabic language with right-to-left (RTL) layout throughout all user-facing pages.
- **FR-012**: System MUST isolate orders by branch - orders at one branch are not visible on another branch's display.
- **FR-013**: System MUST support at least 10 branches operating simultaneously without data conflicts.
- **FR-014**: System MUST parse QR codes that contain JSON with order_id, channel_link, and location fields, and gracefully handle QR codes with missing or malformed data.
- **FR-015**: System MUST provide an analytics view with date range filtering, branch filtering, KPI summaries, and data export.
- **FR-016**: System MUST display elapsed time since scan for each order on the dashboard, refreshing periodically.
- **FR-017**: System MUST provide visual feedback (success animation, vibration) on the mobile scanner after each scan.
- **FR-018**: System MUST be installable as a Progressive Web App on mobile devices.
- **FR-019**: System MUST display a live clock, branch name, and active order count in the dashboard header.
- **FR-020**: System MUST provide branch management capabilities (add, edit, activate/deactivate branches).

### Key Entities

- **Branch**: A restaurant location identified by a unique code, with Arabic and English names and a location label. Can be active or inactive.
- **Order**: A tracked order identified by an order ID from the POS system, associated with a specific branch. Has a status lifecycle (preparing -> ready -> completed), timestamps for each transition, and an optional channel source link. Uniquely identified by the combination of order ID and branch.
- **Scan Log**: A record of each QR code scan event, linked to an order, with scan type (first scan / second scan), timestamp, and optional device information. Used for audit trail and analytics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Kitchen staff can scan a QR code and see the order appear on the display within 1 second of scanning.
- **SC-002**: The complete scan-to-ready workflow (two scans) can be performed in under 5 seconds of active user interaction.
- **SC-003**: System supports 10 branches operating concurrently with zero cross-branch data leakage.
- **SC-004**: Display dashboard is readable from 3 meters distance on a standard TV screen.
- **SC-005**: 95% of QR code scans are successfully parsed and processed on the first attempt.
- **SC-006**: Analytics reports load within 3 seconds for up to 30 days of data across all branches.
- **SC-007**: The system maintains real-time updates without manual page refreshes throughout a full operating day (12+ hours).
- **SC-008**: Preparation time data is accurately recorded for 100% of completed orders (orders that receive both scans).

## Assumptions

- QR codes are pre-printed on POS receipts by the Foodics system; this system does not generate QR codes.
- Kitchen staff have access to a smartphone with a camera and internet connectivity.
- Each branch has a TV/monitor connected to a device with a web browser for the display dashboard.
- The restaurant chain operates primarily in Arabic-speaking regions, making Arabic the primary interface language.
- Authentication is not required for the MVP - the system uses open access with branch-specific URLs for access control.
- The "channel_link" field in QR codes references delivery platform order pages (e.g., Jahez, HungerStation) or direct ordering channels.
- Internet connectivity is generally reliable at branch locations; offline operation is not required for MVP.
- Order volume per branch is moderate (estimated tens to low hundreds of orders per day), not requiring extreme high-throughput optimization.
