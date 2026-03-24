# Application Routes Contract

**Version**: 1.0

## Routes

| Route      | Query Params   | Page               | Description                              |
|------------|----------------|--------------------|------------------------------------------|
| /display   | branch=CODE    | DisplayDashboard   | TV display showing orders in 2 columns   |
| /scan      | branch=CODE    | Scanner            | Mobile QR scanner for kitchen staff      |
| /analytics | (none)         | Analytics          | Management reporting dashboard           |
| /admin     | (none)         | Admin              | Branch management page                   |

## Query Parameters

### `branch` (used by /display and /scan)

- **Type**: string
- **Required**: Yes (for /display and /scan)
- **Format**: Matches `branches.code` column (e.g., "riyadh-01", "jeddah-01")
- **Fallback**: If missing, uses `VITE_DEFAULT_BRANCH` environment variable
- **Validation**: Must match an active branch code. If no match, show error page.

## URL Examples

```
# Display for Riyadh branch (TV screen)
/display?branch=riyadh-01

# Scanner for Jeddah branch (staff phone)
/scan?branch=jeddah-01

# Analytics (all branches, no branch param needed)
/analytics

# Admin page
/admin
```

## Environment Variables

| Variable                   | Type   | Default    | Description                           |
|----------------------------|--------|------------|---------------------------------------|
| VITE_SUPABASE_URL          | string | (required) | Supabase project URL                  |
| VITE_SUPABASE_ANON_KEY     | string | (required) | Supabase anonymous/public key         |
| VITE_DEFAULT_BRANCH        | string | riyadh-01  | Fallback branch code                  |
| VITE_READY_TIMEOUT_MINUTES | number | 5          | Minutes before ready orders auto-clear |
| VITE_SCAN_COOLDOWN_MS      | number | 2000       | Milliseconds between allowed scans    |
