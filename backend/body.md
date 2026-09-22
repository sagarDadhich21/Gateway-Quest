# ARI POST API Bodies (Postman testing)

Both endpoints require:
- `Content-Type: application/json`
- `Authorization: Bearer <token>`

---

## POST `/api/gq/properties/1/ari/availability`

```json
{
  "values": [
    { "roomTypeId": 967, "date": "2026-09-21", "availability": 1 },
    { "roomTypeId": 967, "date": "2026-09-22", "availability": 2 },
    { "roomTypeId": 968, "date": "2026-09-21", "availability": 5 },
    { "roomTypeId": 969, "date": "2026-09-21", "availability": 2 },
    { "roomTypeId": 970, "date": "2026-09-21", "availability": 4 },
    { "roomTypeId": 971, "date": "2026-09-21", "availability": 1 },
    { "roomTypeId": 972, "date": "2026-09-21", "availability": 1 }
  ]
}
```

Notes:
- `roomTypeId` is the **BQ** room type id (967–972 for property 1), not the Channex one.
- `availability` is oversell-guarded against each room type's real physical count from BQ - don't exceed: 967→2, 968→9, 969→4, 970→8, 971→1, 972→1 (the values above are all safely under that).
- All 6 room types already have a real `cx_room_type_id` (onboarded), so this should push through to Channex and come back `verified: true`.

---

## POST `/api/gq/properties/1/ari/restrictions`

```json
{
  "ratePlanId": "901ffec2-ea6e-4bdb-a777-ef003c3cb873",
  "values": [
    {
      "date": "2026-09-21",
      "rate": 3999,
      "minStay": 1,
      "maxStay": 14,
      "closedToArrival": false,
      "closedToDeparture": false,
      "stopSell": false
    },
    {
      "date": "2026-09-22",
      "rate": 4200,
      "stopSell": false
    }
  ]
}
```

Notes:
- `ratePlanId` here is `Suite Queen`'s real GQ id (already has a `cx_rate_plan_id`). Swap in any of your other 5 onboarded rate plan ids to test a different room type.
- `rate` is in **major currency units** (e.g. `3999` = ₹3999.00) - GQ converts to Channex's minor units itself via `toMinorUnits()`, don't pre-multiply by 100.
- `rate` is optional per value - omit it and GQ tries to fetch it from pricing-service for that date instead; only include it explicitly like above if you want a guaranteed, predictable test value.
- Every other field (`minStayArrival`, `minStayThrough`, `minStay`, `maxStay`, `closedToArrival`, `closedToDeparture`, `stopSell`) is optional too, but at least one field besides `date` must be present per value.

---

Both responses include `"verified": true|false` (Channex read-back confirmation) and `"cxTaskId"`.
