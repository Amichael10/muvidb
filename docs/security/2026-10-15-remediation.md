# Security remediation in progress

This tracks work against the 25 findings in the audit. The audit and its reproduction suite describe the original state; the reproduction suite intentionally asserts the original insecure behavior and is not a post-fix acceptance suite.

## Database protections applied

- Removed the publicly callable `force_promote_to_admin` function.
- Stopped the active signup trigger from trusting an administrator role in editable signup metadata.
- Made role changes reject missing administrator profiles.
- Restricted company claim approval to administrators/service callers; bound the recorded reviewer to the authenticated administrator. Claim approval no longer generates a plaintext key in the public company record.
- Restricted the four flagged catalogue mutation functions to verified catalogue administrators or service callers, with fixed search paths.
- Added a service-only, atomic API-key quota function. Its row lock serializes requests across API instances and increments usage without lost updates.
- Removed the broad public write policies on the published `film-images` bucket. Existing private `contributions` uploads and administrator publishing policies remain in place.
- Restricted talent representation writes to verified administrators, approved actor profile managers, or active company owners/admins for that record.
- Removed public access to deletion audit logs and restricted retention cleanup to the service role.

Migrations are timestamped in `supabase/migrations`. The normal `db push` was blocked by an existing local/remote migration history mismatch (`20260920`); the targeted migrations were applied transactionally using the linked Management API and recorded in migration history. Unrelated history was not changed.

## Application changes prepared, not pushed

- Administrator and Social Studio authorization fail closed when the trusted profile is missing or unavailable, instead of trusting editable user metadata.
- WhatsApp self-service profile synchronization no longer writes a role from user metadata.
- Channel-video linking requires an authenticated administrator and POST.
- Removed the cron secret from the two browser callers. The already-exposed credential still requires rotation in all deployed environments and scheduled jobs.
- API-key authorization consumes the database quota before serving requests.
- Public credit lookups require published parent films.
- The data router no longer returns exception messages and stack traces.
- Telegram webhook verification and the media extractor reject requests when their configured authentication secret is absent.
- WhatsApp callbacks now require a valid Meta HMAC signature over the original request bytes. STOP matches the complete normalized number; ordinary message text containing the word STOP does not unsubscribe a user.
- The data router preserves raw webhook bodies before JSON parsing and bounds request size. Existing WebSub XML handling remains supported.
- The image proxy rejects SVG and other unrecognized image formats and limits downloads while reading the stream.

## Validation so far

- 42 focused regression tests passed, covering administrator authorization, API quotas, body parsing, image formats/size, signed WhatsApp callbacks, existing WhatsApp sending/delivery/monitoring, Telegram intake, and YouTube WebSub.
- Generated Supabase types after adding the quota RPC and columns.
- TypeScript validation, production client/SSR build, and media-extractor Python compilation passed.
- Live database checks confirmed the promotion function was removed, anonymous claim approval is denied, and browser roles cannot execute the quota mutation RPC.

## Still outstanding

The full audit remediation is **not complete**. Remaining work includes securing person-media upload/approval end to end, payment order/signature validation, AI/scanner cost controls, media proxy SSRF handling, credential revocation/rotation, local clipper pairing, company sensitive-field protection, editor message validation, dependency updates, and final deployment checks.

WhatsApp signature verification uses the **Meta app's App Secret**, separate from the sending access token and the webhook setup verification token, in `WHATSAPP_APP_SECRET`. The user confirmed privately saving it in Vercel Production. A deployment is needed for that environment change to take effect. Never include its value in this report or chat.
