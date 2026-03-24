# QR Code Payload Contract

**Version**: 1.0 | **Source**: Foodics POS System

## Format

QR codes encode a JSON string with the following schema:

```json
{
  "order_id": "<string, required>",
  "channel_link": "<string, optional>",
  "location": "<string, optional>"
}
```

## Fields

| Field        | Type   | Required | Description                                     | Example                          |
|--------------|--------|----------|-------------------------------------------------|----------------------------------|
| order_id     | string | Yes      | Unique order identifier from Foodics POS        | "#1087"                          |
| channel_link | string | No       | Source channel URL (delivery platform or direct) | "https://jahez.net/order/1087"   |
| location     | string | No       | Branch name/address for auto-detection           | "Riyadh - Al Nuzha"             |

## Example Payloads

### Full payload (delivery order)
```json
{
  "order_id": "#1087",
  "channel_link": "https://jahez.net/order/1087",
  "location": "Riyadh - Al Nuzha"
}
```

### Minimal payload (direct order)
```json
{
  "order_id": "#1088"
}
```

### Fallback behavior
If the QR code does not contain valid JSON, the raw text content is treated as the order_id.

## Parsing Rules

1. Attempt JSON.parse() on raw QR text
2. If successful, extract `order_id` (required), `channel_link` (optional), `location` (optional)
3. If JSON parsing fails, use the trimmed raw text as `order_id`
4. If JSON parses but `order_id` is missing/empty, treat as parse error (use raw text)

## Known Channel Sources

| Platform      | URL Pattern                          |
|---------------|--------------------------------------|
| Jahez         | https://jahez.net/order/*            |
| HungerStation | https://hungerstation.com/order/*    |
| Direct        | null or empty                        |
