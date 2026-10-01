Implement Phase 5 — Channex Channel Connection & OTA Mapping.
 
Property, Room Type, Rate Plan and ARI phases are already implemented and working. Do not rewrite or break them.
 
### 1. Channel Connection
Implement the Channex channel connection flow for an onboarded property.
 
- Verify `cx_property_id` exists before allowing channel setup.
- Add the required Channex Channel/One-Time-Auth APIs using the existing Channex client.
- Generate/use Channex one-time token where required for the channel/IFrame flow.
- Get the property's connected channels from Channex.
- Expose GQ APIs to:
  - list connected channels
  - generate channel connection token
  - get channel details/status
  - activate/deactivate where supported
- Keep Channex credentials/API keys server-side.
- Follow existing authentication, property ownership, logging and error-handling patterns.
 
### 2. OTA Mapping
After a channel is connected:
 
- Get channel mapping/listing information from Channex.
- Map OTA/channel room types → existing GQ/BQ room types.
- Map OTA/channel rate plans → existing GQ rate plans.
- Store only the required mapping IDs/state in GQ.
- Do not duplicate BQ master data.
- Validate that the room/rate belongs to the same property.
- Do not allow mappings for non-onboarded room types/rate plans.
- Make mapping operations idempotent.
 
Expected logical mapping:
 
OTA Room
   ↕
cx_room_type_id
 
OTA Rate
   ↕
cx_rate_plan_id
 
### 3. APIs
Follow the existing GQ route conventions and add the necessary APIs for:
 
- list channels
- generate connection token
- channel details/status
- channel mapping/listing
- create/update/remove room mapping
- create/update/remove rate mapping
 
Use the exact Channex endpoints supported by the current API/client; do not invent endpoints.
 
### 4. Database
Before changing Prisma:
 
- inspect the existing schema
- reuse existing mapping fields/models if available
- only add models/fields that are genuinely required for channel mappings
- keep BQ as the source of truth for property/room master data
 
### 5. Important
- Do NOT implement bookings/webhooks yet.
- Do NOT implement ARI again.
- Do NOT implement queues/cache/deployment/CI/CD.
- Do NOT modify working Property, Room Type, Rate Plan or ARI functionality.
- Reuse existing Channex/BQ clients, authentication, logger and error handling.
- Update Swagger and tests.
 
Before coding, inspect the current GQ code and Channex collection/API examples and use those as the source of truth.
 
After implementation, report:
1. Files changed
2. APIs added
3. Channex endpoints used
4. DB/schema changes
5. Channel mapping flow
6. Room/rate mapping flow
7. Tests completed
8. Any unresolved Channex API limitations



# PHASE 6 — Booking Ingestion & Reservation Sync
 
Implement Phase 6 of Gateway Quest (GQ).
 
Goal:
 
OTA → Channex → GQ → BQ/HMS
 
Before coding, inspect the existing GQ codebase and actual BQ APIs/schema. Reuse existing architecture and do not invent APIs.
 
## 1. Channex Webhook
 
Implement:
 
POST /api/gq/webhooks/channex
 
- Public HTTPS endpoint.
- Use the project's configured webhook verification.
- Persist the incoming Channex revision/event.
- Return 200 quickly.
- Process booking asynchronously using the existing project architecture.
- Do not require normal user JWT authentication.
 
## 2. Booking Revision Processing
 
Support:
 
- New booking
- Booking modification
- Booking cancellation
- Unmapped room/rate-plan cases
 
Persist revision information with:
 
- revision ID
- property ID
- event/status
- processing attempts
- error
- BQ booking ID
- timestamps
 
Use revision ID for idempotency. The same revision must never create duplicate BQ bookings.
 
## 3. Mapping
 
Resolve:
 
Channex property ID
→ BQ property.cx_property_id
 
Channex room_type_id
→ BQ roomtype.cx_room_type_id
 
Channex rate_plan_id
→ GQ rate_plan.cx_rate_plan_id
 
If mapping is missing, do not create an incorrect booking. Store the failure and make the revision retryable.
 
## 4. BQ Booking
 
For a new OTA booking:
 
- Use existing BQ booking API.
- booking_type = OTA
- booking_status = Confirmed where applicable.
- roomid = NULL if physical room assignment is unavailable.
- idempotency_key = Channex revision ID.
- Use the OTA/Channex booking amount; do not recalculate it using pricing-service.
- After creation, verify the booking through BQ API.
- Store the BQ booking ID in GQ.
 
For modification/cancellation, use existing BQ APIs. If cancellation API does not exist, implement the minimum required BQ API change following the existing architecture.
 
GQ must NOT directly modify BQ database tables.
 
## 5. Revision Feed / Recovery
 
Implement the Channex Booking Revision Feed as the fallback mechanism.
 
- Run approximately every 15 minutes according to the project design.
- Process missed revisions through the SAME booking-processing service used by webhooks.
- Maintain idempotency.
- Do not create duplicate bookings.
 
## 6. Acknowledgement
 
Acknowledge the Channex revision only after successful durable processing in BQ.
 
If mapping/BQ processing fails:
 
- do not falsely acknowledge it.
- persist the error.
- allow retry/recovery.
 
## 7. Error Handling & Logging
 
Handle:
 
- invalid webhook
- duplicate revision
- unknown property
- unmapped room/rate plan
- Channex failure
- BQ failure
- timeout
- invalid booking data
 
Add structured logs with:
 
- correlation ID
- revision ID
- Channex booking/property ID
- BQ booking ID
- processing status
- error
 
Never log secrets or payment/card information.
 
## 8. Swagger & Tests
 
Add Swagger documentation and automated tests for:
 
- webhook authentication
- new booking
- duplicate booking
- modification
- cancellation
- mapping failures
- Channex/BQ failures
- retry/recovery
- revision feed
- idempotency
 
Do not implement frontend, deployment, CI/CD, Terraform, Kubernetes, or unrelated features.
 
## Final Flow
 
Channex/OTA
→ Webhook / Revision Feed
→ GQ Revision
→ Property/Room/Rate Mapping
→ BQ Booking API
→ Verify BQ Booking
→ Acknowledge Channex
 