# Data Model: QR Order Tracking System

**Date**: 2026-03-23 | **Branch**: `001-qr-order-tracking`

## Entities

### Branch

Represents a physical restaurant location in the chain.

| Field          | Type      | Constraints                          | Description                          |
|----------------|-----------|--------------------------------------|--------------------------------------|
| id             | UUID      | PK, auto-generated                   | Unique identifier                    |
| name_ar        | Text      | Required                             | Branch name in Arabic                |
| name_en        | Text      | Required                             | Branch name in English               |
| code           | Text      | Required, Unique                     | URL-friendly identifier (e.g., "riyadh-01") |
| location_label | Text      | Required                             | Human-readable location for QR matching |
| is_active      | Boolean   | Default: true                        | Whether branch accepts new orders    |
| created_at     | Timestamp | Default: now(), with timezone        | Record creation time                 |

**Relationships**: One branch has many orders.

### Order

Represents a tracked order from the POS system, scoped to a specific branch.

| Field                 | Type      | Constraints                                      | Description                              |
|-----------------------|-----------|--------------------------------------------------|------------------------------------------|
| id                    | UUID      | PK, auto-generated                               | Unique identifier                        |
| order_id              | Text      | Required                                         | POS order identifier (e.g., "#1087")     |
| branch_id             | UUID      | Required, FK -> Branch.id                        | Associated branch                        |
| channel_link          | Text      | Optional                                         | Source channel URL (Jahez, HungerStation) |
| status                | Text      | Required, one of: preparing, ready, completed    | Current order lifecycle state            |
| scanned_at            | Timestamp | Default: now(), with timezone                    | When the first scan occurred             |
| ready_at              | Timestamp | Optional, with timezone                          | When the second scan occurred            |
| completed_at          | Timestamp | Optional, with timezone                          | When the order was cleared from display  |
| prep_duration_seconds | Integer   | Computed: ready_at - scanned_at (in seconds)     | Preparation time for analytics           |
| raw_qr_data           | JSON      | Optional                                         | Full raw QR payload for debugging        |
| created_at            | Timestamp | Default: now(), with timezone                    | Record creation time                     |

**Uniqueness**: (order_id, branch_id) — same order ID can exist at different branches but not duplicated within a branch.

**Relationships**: One order belongs to one branch. One order has many scan logs.

### Scan Log

Audit trail of every QR code scan event.

| Field       | Type      | Constraints                              | Description                          |
|-------------|-----------|------------------------------------------|--------------------------------------|
| id          | UUID      | PK, auto-generated                       | Unique identifier                    |
| order_id    | UUID      | Required, FK -> Order.id                 | Associated order                     |
| scan_type   | Text      | Required, one of: first_scan, second_scan | Which scan this represents           |
| scanned_by  | Text      | Optional                                 | Staff identifier (future use)        |
| scanned_at  | Timestamp | Default: now(), with timezone            | When the scan occurred               |
| device_info | Text      | Optional                                 | Browser/device info (future use)     |

**Relationships**: Many scan logs belong to one order.

## State Transitions

### Order Status Lifecycle

```
[New QR Scan] ──> PREPARING ──> READY ──> COMPLETED
                   (1st scan)   (2nd scan)  (timeout)
```

| From      | To        | Trigger                                | Side Effects                         |
|-----------|-----------|----------------------------------------|--------------------------------------|
| (none)    | preparing | First scan of QR code at branch        | Set scanned_at, create scan_log      |
| preparing | ready     | Second scan of same QR code at branch  | Set ready_at, compute prep_duration, create scan_log |
| ready     | completed | Display timeout expires (default 5 min)| Set completed_at, remove from display |

**Invalid transitions**:
- ready -> preparing (cannot go backwards)
- completed -> any (terminal state)
- Duplicate scan of "ready" order: ignored with user notification

## Validation Rules

- **Order ID**: Required, non-empty string. The system accepts any format from the POS (e.g., "#1087", "ORD-1087").
- **Branch Code**: Must match an active branch in the system. Validated on scanner/display page load.
- **QR Data**: JSON parsing attempted first. If parsing fails, raw text is used as order_id. At minimum, order_id must be extractable.
- **Scan Cooldown**: Client-side enforcement of 2-second minimum between scans to prevent accidental double-scans.
- **Unique Order per Branch**: Enforced at database level — inserting a duplicate (order_id, branch_id) pair fails and is handled as a second scan attempt.

## Access Control (MVP)

- **Branches table**: Read-only for all users (public select).
- **Orders table**: Full access for all users (public insert/update/select). Scoped by branch_id in application logic.
- **Scan Logs table**: Full access for all users (public insert/select).
- **Admin page**: No authentication. Accessible to anyone with the URL. Acceptable for MVP; authentication planned for Phase 2.

## Seed Data

Initial branches for deployment:

| code       | name_ar                        | name_en               | location_label        |
|------------|--------------------------------|-----------------------|-----------------------|
| riyadh-01  | فرع الرياض - حي النزهة         | Riyadh - Al Nuzha     | Riyadh - Al Nuzha     |
| jeddah-01  | فرع جدة - حي الروضة           | Jeddah - Al Rawdah    | Jeddah - Al Rawdah    |
| dammam-01  | فرع الدمام - حي الفيصلية      | Dammam - Al Faisaliah | Dammam - Al Faisaliah |

Additional branches (up to 10) to be added during deployment based on the restaurant chain's actual locations.
