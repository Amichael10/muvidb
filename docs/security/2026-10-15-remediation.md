# Security remediation — 15 October 2026

This records changes against the 25 findings in the accompanying audit. The audit describes the original baseline; its reproduction tests intentionally demonstrate the original vulnerabilities. Application regression tests validate the fixes.

## Changes and practical effects

| Finding | Protection added | Practical effect |
|---|---|---|
| 01: Public admin promotion | Removed the promotion RPC from the live database. | Ordinary accounts cannot promote themselves through it. |
| 02: Editable metadata grants privileges | Trusted database roles govern signup, admin checks and WhatsApp profile sync; missing profiles fail closed. | Editing account metadata cannot grant administrator access. |
| 03: Browser cron credential | Removed browser callers and VITE_CRON_SECRET; replaced CRON_SECRET in Vercel Production/Preview, GitHub Actions, Cloudflare publishing and local files. | Scheduled jobs use a new server-only credential. Live authenticated and unauthenticated probes passed. |
| 04: Anonymous company approval | Administrator-only approval; reviewer bound to the authenticated administrator. | Applicants cannot approve their own claims. |
| 05: Public person-media mutation | Authentication, ownership checks, quotas, private staging, format validation and admin review. | Uploads remain allowed but stay private until approved. |
| 06: Public channel linking | Administrator JWT and POST required. | Visitors cannot attach videos to catalogue records. |
| 07: Fake sandbox payment | Removed sandbox confirmation grants; sandbox settlement never grants a paid tier. | Simulated payments cannot unlock real subscriptions. |
| 08: Forged payment webhook | Documented signatures, recorded orders, server prices, matching amount/currency/transaction IDs and atomic replay-resistant settlement. | Only a matching verified payment activates access. Old unrecorded checkouts cannot activate through this flow. |
| 09: Forged WhatsApp event | Meta HMAC over exact raw bytes, exact STOP command and complete phone-number matching. | Fake delivery receipts/opt-outs fail. Live unsigned probe returned 401. |
| 10: Public storage writes | Removed broad published-bucket writes; retained private contributions and added private person-media staging. | People can submit files; administrators alone publish them. |
| 11: Representation editing | Restrict writes to admins, approved actor managers and relevant active company owners/admins. | One user cannot edit another agency's relationships. |
| 12: Public deletion logs | Admin reads, service-only writes and retention. | Ordinary accounts cannot read or falsify deletion logs. Historical records are not retroactively trustworthy. |
| 13: Catalogue mutation RPCs | Verified admin/service callers, restricted grants and fixed search paths. | Public callers cannot run privileged batch mutations. |
| 14: Paid AI/scanner abuse | Professional authorization, shared atomic user/IP/global quotas, bounded input and admin-only scanner POST. | Public search stays available within limits; paid tools require an appropriate account. |
| 15: Image proxy SSRF | Validate every DNS answer and redirect; pin validated DNS, reject reserved networks, cap bytes/time. | Proxy cannot fetch internal services or buffer unlimited downloads. |
| 16: Active SVG content | Raster-only proxy, sandbox response policies for SVG/storage, re-encoded uploaded photos. | These image paths cannot execute uploaded SVG scripts. |
| 17: Tracked secrets/cookies | Removed credential-bearing scripts/cookies from tracking and the container image; migrated backend credentials; disabled legacy API keys; deleted exposed interim secret keys; revoked the old HS256 signer. | The committed Supabase JWT and both exposed replacement keys now return 401. Historical third-party browser sessions must still be invalidated at their providers. |
| 18: Local clipper abuse | Loopback client/Host, exact trusted origins and per-process pairing token. | Unrelated websites cannot start jobs. Restart the desktop clipper to apply this. |
| 19: Editable company entitlements | Database guards protect verification, claims and tiers; plaintext company API keys prohibited. | Profile edits cannot grant paid or verified status. |
| 20: Unenforced API limits | Service-only row-locked quota consumption. | Concurrent requests count correctly toward each key's limit. |
| 21: Draft credit exposure | Public credit lookups require published parent films. | Draft film information stays hidden. |
| 22: Forged editor messages | Removed obsolete cross-window render listener; current editor uses direct callbacks. | Forged browser messages cannot inject a draft render. |
| 23: Errors/browser policy | Generic public errors, bounded bodies, explicit CORS/security headers and local-only dev binding. Vercel Standard Protection enabled. | Custom public domains remain public; generated/old deployment URLs require authentication. |
| 24: Dependencies | Updated all five lockfiles, runtime packages and maintained SheetJS distribution. | Main production dependency audit is clear; development advisories remain below. |
| 25: Missing auxiliary secrets | Telegram and extractor reject missing authentication secrets. | Missing configuration disables access rather than leaving it open. |

## Database rollout

Nine timestamped security migrations have been applied and registered in migration history. Normal db push encountered the pre-existing local/remote mismatch at `20260920`; only reviewed migrations were applied transactionally through the linked Management API. Unrelated history and catalogue data were preserved. Supabase types were regenerated.

The profile-media guard blocks new public media through direct profile writes. Existing public highlights may be removed/reordered and existing photos selected as primary. New or changed media still requires review. Six live SQL fixture checks passed, including rejection of new URLs and invalid primary flags.

## Validation

- Root suite: 77 files, 528 tests: **522 passed, 3 skipped, 3 failed**. Failures concern unchanged social-render dimensions, editorial landscape-video filtering and social-copy Instagram fallback expectations. Related source/tests and rendering dependency versions were unchanged. These failures were not hidden or weakened.
- All new security regression tests passed. Earlier hardening batch passed 42 focused tests.
- TypeScript validation, production client/SSR build, OpenCut build, four Python clipper security tests and Python compilation passed.
- Main production dependency audit: **zero known vulnerabilities**. Content engine and scraper: zero. Remaining development-tool advisories: root eight high; OpenCut seven; launch-video ten. Some transitive packages have no compatible published fix; forced breaking upgrades were not treated as safe fixes.
- Live checks confirmed restricted privileged RPCs and service-only quota mutations. Public custom domain returned 200. Unsigned WhatsApp callback returned 401; a genuine signed Meta callback still needs observation.
- No real payment, unsolicited WhatsApp message, bulk catalogue cleanup or public upload was performed for testing. Provider sandbox checkout is still needed to certify end-to-end payment integration.

## Credential and deployment closure

The project now uses its ES256 signing key exclusively. Legacy API keys were already disabled, and the older HS256 signing key was revoked on 16 October 2026 after all known consumers were migrated. The previously committed service JWT and both exposed interim replacement keys now return 401; the final backend secret returns 200.

Vercel Production/Preview, GitHub Actions, both Cloudflare Worker environments, Render and local files now use modern publishable/secret keys and the rotated cron credential. VITE_CRON_SECRET was removed. Social-token encryption and OAuth state have separate configured secrets, preventing disruption from this credential migration.

Cloudflare production and staging run the corrected Worker bundle with rotated SUPABASE_SERVICE_ROLE_KEY and PUBLISHER_TOKEN values. Both health checks report configured secrets, and both database-backed destination endpoints return `source: supabase`. Render runs commit `60bcde2`, with the final secret stored in its environment; its deployment and health check are live. The Docker image no longer copies cookie files.

Vercel deployed the final environment configuration successfully as deployment `dpl_HXf1n3a832KtWXDY81oUf2TFGaHD`, aliased to `muvidb.com`. Live probes: home 200 with CSP/nosniff; media authentication 401; both sandbox grants 410; unsigned WhatsApp callback 401; rotated cron health 200; missing cron 401. The old generated deployment redirects to Vercel SSO (302). Vercel configuration confirms VITE_CRON_SECRET is absent.

The remaining operational follow-up is provider-side invalidation of any historical Google/YouTube or Instagram browser session copied into the old tracked cookie file, plus replacement of any Meta access token that was displayed outside secret storage. Repository and current container copies have been removed, but deleting a file cannot invalidate a session or token already issued by those providers.

## References

- [Supabase API-key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) and [signing keys](https://supabase.com/docs/guides/auth/signing-keys).
- [OPay callback signing](https://documentation.opaycheckout.com/callback-signature).
- [Bachs webhook verification](https://docs.bachs.io/guides/webhooks/overview) and [collection success](https://docs.bachs.io/guides/webhooks/events/collection-succeeded).
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection).
