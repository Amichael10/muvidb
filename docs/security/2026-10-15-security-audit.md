# MuviDB security audit — 15 October 2026

**Assessment: urgent remediation needed.** The administrator and company-verification trust boundaries have multiple independent bypasses. These are not merely dependency warnings.

**Baseline:** `a5ceaaa0a25a33684cc093b118c5c2efc6883723` (`main`). Existing local script/data changes were left untouched.

**Findings:** 25 — **4 Critical, 16 High, 5 Medium.** Confidence and deployment prerequisites are stated per finding. The counts include configuration-dependent risks; they do not mean 25 production exploits were executed.

This is a repository-wide security assessment of exposed trust boundaries, supported by live read-only database catalog inspection and isolated local reproductions. It is not a claim that every line was manually reviewed or that every remaining vulnerability has been discovered.

No account was promoted, no claim approved, no real payment forged, no media deleted/uploaded, and no production SSRF/XSS exploit executed. No application code, policies or credentials were changed during the audit. Only report/evidence/test artifacts were created. The audit did not establish that an attacker has used these issues.

## Highest-priority actions

1. Remove anonymous execution of force_promote_to_admin and approve_company_claim.
2. Fix the **active** signup role trigger, remove role writes from WhatsApp self-service sync, and make all authorization fail closed.
3. Remove browser cron credentials, rebuild, rotate runtime/workflow credentials and reject retired values.
4. Authenticate media/linkage mutations, disable production sandbox grants and require valid payment/WhatsApp webhook signatures.
5. Tighten database/storage policies and catalogue-write RPCs, then rotate committed credentials/session material and investigate historical access.

Fix these together: patching one admin bypass leaves the others available. Preserve relevant logs and role/claim state before cleanup. deletion_logs currently cannot be trusted as an immutable incident record.

## Scope, method and limitations

- Inventoried **2,005 tracked files**, including **1,567 source/SQL/script files**. Searched application/server/worker/local-service/script/configuration surfaces and triaged credential-pattern matches. This is inventory plus targeted manual review, not line-by-line verification of all 1,567 files.
- Reviewed public API routing and key privileged handlers, identity/profile flows, service-role query use, webhooks, uploads, image proxying, SSR loaders, browser messages, Vercel/Vite settings and GitHub workflows.
- Queried the linked database read-only: **217 policies across 89 policy targets**, **209 public functions**, table grants, active users triggers and selected column privileges. The public view/materialized-view query returned zero rows. Live definitions were compared with migration source to avoid trusting an inactive older fix.
- Ran npm audit against all five lockfile projects without upgrading packages. Deployed Python transitive dependencies were not certified: no reviewed locked deployment environment was available for those services.
- **12 local reproductions** confirmed unsafe API behavior using mocked database, storage and HTTP dependencies. They deliberately assert the insecure behavior and currently pass because the vulnerabilities exist. They are evidence, not acceptance tests to keep passing after a fix.
- No brute-force, third-party target scan, account creation, production privilege change, actual payment or production mutation was performed. A credential HEAD probe requesting zero records and a public static-asset fetch were attempted, but both failed due to connectivity. Neither credential validity nor revocation was established by those attempts.
- Hosting WAF rules, actual extractor secret configuration, Google API-key restrictions, full credential history, browser private-network permissions and production access-log forensics were not independently verified. Source/deployment parity for every HTTP path was not certified.

## Finding index

| ID | Severity | Finding |
|---|---|---|
| SEC-01 | Critical | Anonymous administrator-promotion RPC |
| SEC-02 | Critical | User-editable metadata becomes an authoritative administrator role |
| SEC-03 | Critical | Server cron credential embedded in browser JavaScript |
| SEC-04 | Critical | Company claims can be approved anonymously, granting verified ownership |
| SEC-05 | High | Person-media CRUD and upload capabilities are unauthenticated |
| SEC-06 | High | Channel/video linkage permits unauthenticated catalogue writes |
| SEC-07 | High | Sandbox payment confirmation activates paid tier without payment |
| SEC-08 | High | Payment webhooks accept unsigned or invalid success events |
| SEC-09 | High | WhatsApp POST webhook trusts unsigned opt-outs and delivery receipts |
| SEC-10 | High | Public image-storage write policies remain active |
| SEC-11 | High | All authenticated users can edit every talent representation |
| SEC-12 | High | Deletion audit records are publicly readable and writable |
| SEC-13 | High | Catalogue-write RPCs bypass intended administrator checks |
| SEC-14 | High | Public APIs expose paid AI work and an administrative scanner |
| SEC-15 | High | Public image proxy permits SSRF and unbounded buffering |
| SEC-16 | High | Attacker SVG can be served as active same-origin content |
| SEC-17 | High | Privileged credentials and browser cookies are tracked in Git |
| SEC-18 | High | Desktop clipper trusts arbitrary browser origins without authentication |
| SEC-19 | High | Company profile writes include entitlements and verification; secret column is public |
| SEC-20 | Medium | Developer API reports per-key rate limits but does not enforce them |
| SEC-21 | Medium | Secondary credit APIs omit unpublished-film visibility gates |
| SEC-22 | Medium | Social Studio accepts render messages from unverified windows/origins |
| SEC-23 | Medium | Public error stacks and incomplete explicit browser-security policy |
| SEC-24 | High | Published dependency advisories affect all five npm projects |
| SEC-25 | Medium | Auxiliary service authentication can fail open when secrets are missing |

## Detailed findings

### SEC-01 — Anonymous administrator-promotion RPC

**Severity:** Critical
**Validation:** Live definition and execution grants confirmed; function not invoked.

**Source:** [supabase/migrations/20260610000004_emergency_fixes.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260610000004_emergency_fixes.sql:36). Live-state details are also summarized in the evidence JSON.

**Evidence.** The deployed force_promote_to_admin(text) is SECURITY DEFINER and callable by both anon and authenticated. Its body looks up an email, sets public.users.role to admin and writes admin metadata to auth.users. It has no caller authorization check.

**Impact.** An unauthenticated caller can request admin rights for an account they control. This defeats the administrator boundary independently of the other findings.

**Recommended fix.** Remove the emergency helper, or revoke execution from PUBLIC, anon and authenticated and implement an explicit full-admin check inside any replacement. Fix a deterministic search_path and preserve privileged-change audit records. Review existing administrator assignments.

**Retest.** Anonymous and ordinary authenticated callers must be rejected, including when supplying a valid account email. Only the intended trusted path may change roles.

### SEC-02 — User-editable metadata becomes an authoritative administrator role

**Severity:** Critical
**Validation:** Active database trigger confirmed; profile-write and guard fallbacks reproduced locally.

**Source:** [supabase/migrations/20260427150000_add_user_last_login.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260427150000_add_user_last_login.sql:8); [api/_lib/whatsapp_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/whatsapp_handler.ts:104); [api/_lib/auth.ts](C:/Users/User/Filmdba/lumi/api/_lib/auth.ts:42); [api/_lib/social_studio.ts](C:/Users/User/Filmdba/lumi/api/_lib/social_studio.ts:78). Live-state details are also summarized in the evidence JSON.

**Evidence.** The live auth.users INSERT trigger calls handle_user_sync(), whose live definition accepts admin/admin_limited from raw_user_meta_data.role. A separately hardened handle_new_user exists but is not the active signup trigger. WhatsApp opt-in/update-profile/sync-user also copies user_metadata.role into public.users using the service-role client. Local mocks confirmed an admin value is persisted. Backend admin guards fall back to user metadata when a profile is absent; a local test confirmed acceptance. Live admin_change_role additionally uses a nullable subquery != admin authorization check.

**Impact.** A user can cross the administrator boundary through signup metadata or later profile sync. Ordinary authentication is insufficient when the user controls the role source. Missing database profiles can also produce a fail-open authorization path.

**Recommended fix.** Fix the active handle_user_sync trigger, remove role from self-service upserts, reject elevated signup metadata and use server-controlled profiles/app_metadata as authority. Missing/error profiles must deny access. Use positive boolean admin checks or IS DISTINCT FROM rather than nullable inequality checks. Review accounts created through these flows.

**Retest.** Signup and metadata-update requests containing admin/admin_limited remain ordinary users. Missing profiles and database errors deny access. Legitimate privileged role assignment works only through a separately authorized operation.

### SEC-03 — Server cron credential embedded in browser JavaScript

**Severity:** Critical
**Validation:** Source and existing build confirmed; production asset fetch failed due to network connectivity.

**Source:** [src/pages/admin/AdminOverview.jsx](C:/Users/User/Filmdba/lumi/src/pages/admin/AdminOverview.jsx:228); [src/pages/admin/AdminYouTubeVideos.jsx](C:/Users/User/Filmdba/lumi/src/pages/admin/AdminYouTubeVideos.jsx:822); [api/_lib/auth.ts](C:/Users/User/Filmdba/lumi/api/_lib/auth.ts:21). Live-state details are also summarized in the evidence JSON.

**Evidence.** Browser components reference VITE_CRON_SECRET. A redacted byte comparison found the locally configured CRON_SECRET and VITE_CRON_SECRET in build/client/assets/AdminOverview-Dc8kMHAI.js. The value is accepted by the backend cron authentication branch. UI route protection does not restrict downloading the chunk. No secret values are included in this report.

**Impact.** Anyone obtaining the shipped value can satisfy cron authentication for privileged maintenance and publishing operations. The old chunk remains sensitive after a later deployment unless the credential is rotated.

**Recommended fix.** Remove browser cron-secret usage and use each signed-in administrator JWT for manual actions. Rebuild, rotate runtime and GitHub Actions cron secrets, reject the retired value and address cached old assets. Scan generated client chunks and source maps in CI.

**Retest.** No generated browser artifact contains privileged secrets; retired secrets are rejected while legitimate admin JWT calls and scheduled jobs continue working.

### SEC-04 — Company claims can be approved anonymously, granting verified ownership

**Severity:** Critical
**Validation:** Live definition and execution grants confirmed; claim approval not executed.

**Source:** [supabase/migrations/20261006000000_company_dashboard_and_membership.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20261006000000_company_dashboard_and_membership.sql:158). Live-state details are also summarized in the evidence JSON.

**Evidence.** Live approve_company_claim(uuid,uuid) is SECURITY DEFINER and callable by anon and authenticated. It has no reviewer/admin guard. It approves the claim, marks the company claimed/verified, creates a plaintext live-style API key when missing, sets pro tier and inserts an active owner membership. The default reviewer argument auth.uid() is an audit-field default, not an access check.

**Impact.** A claimant can bypass manual verification to take ownership of a company profile. An anonymous caller who knows a claim ID can approve it. This can be chained with unrestricted company-field updates and public API-key selection.

**Recommended fix.** Restrict execution to the intended trusted service/admin path and verify the actual caller inside the function. Bind reviewer identity to that caller, validate verified claim state and conflicting ownership, and make approval atomic and auditable.

**Retest.** Anonymous callers and ordinary claimants/members cannot approve a claim, even with valid claim/reviewer IDs. Valid admin approval must preserve verification and ownership invariants.

### SEC-05 — Person-media CRUD and upload capabilities are unauthenticated

**Severity:** High
**Validation:** Unauthenticated deletion and HTML upload-capability issuance reproduced with mocks.

**Source:** [api/_lib/person_media_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/person_media_handler.ts:14); [api/data.ts](C:/Users/User/Filmdba/lumi/api/data.ts:76); [api/_lib/r2.ts](C:/Users/User/Filmdba/lumi/api/_lib/r2.ts:29). Live-state details are also summarized in the evidence JSON.

**Evidence.** DELETE accepts an arbitrary media ID; POST/PUT accept supplied record fields; presign and base64-upload branches lack session/admin/ownership checks. Presigning accepts client MIME types and returns a 30-minute capability. Inserts default to approved status. Local tests reached deletion and obtained a capability for text/html without authentication.

**Impact.** Anonymous callers can tamper with actor media, bypass moderation and consume project storage/bandwidth or host abusive content. Service-role queries bypass database RLS.

**Recommended fix.** Authenticate every mutation and upload-capability path; require person ownership or explicit admin authority. Allowlist editable fields and verified file types/size, use scoped server-generated keys and pending moderation for user submissions.

**Retest.** All unauthenticated mutations/presigns fail before work; users cannot affect other people or self-approve uploads. MIME mismatches and oversized files are rejected.

### SEC-06 — Channel/video linkage permits unauthenticated catalogue writes

**Severity:** High
**Validation:** Write path reproduced locally without a session.

**Source:** [api/_lib/channels_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/channels_handler.ts:31). Live-state details are also summarized in the evidence JSON.

**Evidence.** The link_video branch precedes authentication and writes channel_videos and films streaming/source fields with the service-role client. GET and POST are accepted at handler entry; query action can select the mutation branch. The later yt_search authentication check does not protect linkage.

**Impact.** An anonymous caller can attach/detach videos/channels or overwrite film streaming metadata. A request-rate check does not authorize writes.

**Recommended fix.** Require an authorized admin before the branch, restrict mutations to POST, validate referenced UUIDs/video IDs and update related records atomically.

**Retest.** Anonymous, ordinary-user and GET requests cannot reach any linkage write. Authorized linkage preserves film/channel relationships.

### SEC-07 — Sandbox payment confirmation activates paid tier without payment

**Severity:** High
**Validation:** OPay and Bachs bypasses both reproduced locally.

**Source:** [api/_lib/opay_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/opay_handler.ts:155); [api/_lib/bachs_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/bachs_handler.ts:150). Live-state details are also summarized in the evidence JSON.

**Evidence.** confirm_sandbox accepts arbitrary companyId/reference and sets companies.api_tier=pro. Neither handler requires a session, company ownership, verified payment or a nonproduction environment. Production routing still includes these operations.

**Impact.** Anyone can set the paid-entitlement state without payment. Removing checkout/support UI does not disable this server operation.

**Recommended fix.** Remove sandbox operations from production routing. If retained for development, gate them server-side to an explicit nonproduction environment with admin authentication and isolated test records. Grant live tier only from a verified, bound order.

**Retest.** Production rejects sandbox operations regardless of request fields. Live activation requires the correct verified order, amount, currency, plan and account.

### SEC-08 — Payment webhooks accept unsigned or invalid success events

**Severity:** High
**Validation:** Unsigned OPay and Bachs success paths reproduced locally.

**Source:** [api/_lib/opay_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/opay_handler.ts:199); [api/_lib/bachs_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/bachs_handler.ts:194). Live-state details are also summarized in the evidence JSON.

**Evidence.** OPay conditionally checks signatures only when selected payload/header fields exist and logs mismatches without rejecting. Bachs skips verification when the signature header is absent. Both success paths can enable pro from event fields. The reviewed entitlement paths do not verify a stored amount/currency/order binding or durable event idempotency.

**Impact.** Forged or replayed success events can grant entitlements. A genuine event for the wrong or underpriced order can also be mishandled if provider metadata is treated as sufficient authority.

**Recommended fix.** Require configured secrets and provider-defined raw-body signature verification before parsing side effects. Reject missing/mismatched signatures; apply freshness where supported. Reconcile a stored order and enforce amount, currency, plan, company and idempotent event state.

**Retest.** Missing, incorrect and stale signatures cause no writes. Duplicate valid events are harmless, and valid signatures on mismatched orders cannot activate a plan.

### SEC-09 — WhatsApp POST webhook trusts unsigned opt-outs and delivery receipts

**Severity:** High
**Validation:** Unsigned STOP mutation reproduced locally; absence of signature verification confirmed.

**Source:** [api/_lib/whatsapp_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/whatsapp_handler.ts:32); [api/_lib/whatsapp_delivery_status.ts](C:/Users/User/Filmdba/lumi/api/_lib/whatsapp_delivery_status.ts:4). Live-state details are also summarized in the evidence JSON.

**Evidence.** POST handling does not verify X-Hub-Signature-256. The GET verify token only verifies subscription setup. A caller-supplied STOP event updates preferences by a phone suffix, and status events affect rows matching the supplied message ID. The recently added delivery/retry monitoring consumes these callbacks as trusted events.

**Impact.** A forged STOP can disable alerts for a matching number. An attacker who learns a message ID can falsify delivery/failure state and influence retry/monitoring decisions. Message IDs are not a substitute for callback authentication.

**Recommended fix.** Verify the Meta HMAC over original raw bytes using the correct WhatsApp app secret before any mutation. Reject absent/invalid signatures, validate expected WABA/phone metadata and use exact normalized phone matching. Keep the WhatsApp app secret distinct from unrelated social-app credentials.

**Retest.** Unsigned/tampered STOP and status callbacks are rejected with no writes; genuine signed batches and provider retries continue working.

### SEC-10 — Public image-storage write policies remain active

**Severity:** High
**Validation:** Live storage policies and grants confirmed; destructive Storage API testing not performed.

**Source:** [supabase/migrations/20260610000000_fix_security_lints.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260610000000_fix_security_lints.sql:279). Live-state details are also summarized in the evidence JSON.

**Evidence.** Live storage.objects policies named auth users upload/update/delete film images apply to PUBLIC and only check bucket_id=film-images. anon has INSERT/UPDATE/DELETE grants. The stricter img_* admin policies alongside them do not narrow permissive policies. Their names are not reliable evidence of authentication.

**Impact.** Anonymous new-object upload is allowed by policy. UPDATE/DELETE predicates are also broad, but end-to-end overwrite/deletion may additionally depend on Storage API SELECT checks and was not demonstrated. Unauthorized storage consumption and content hosting are the minimum concern.

**Recommended fix.** Drop broad PUBLIC write policies and keep explicit owner/admin writes. Enforce bucket MIME/size limits and separate pending user contributions. Review unexpected objects. Permissive policies combine with OR; adding stricter ones alone is insufficient.

**Retest.** Anonymous uploads/changes are denied; ordinary users cannot change catalogue assets. Intended public image URL reads remain available.

### SEC-11 — All authenticated users can edit every talent representation

**Severity:** High
**Validation:** Live policy and grants confirmed.

**Source:** [supabase/migrations/20260920150000_create_talent_representations.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260920150000_create_talent_representations.sql:32). Live-state details are also summarized in the evidence JSON.

**Evidence.** The FOR ALL policy named Service role write access includes authenticated and service_role with USING(true) and WITH CHECK(true). It contains no person ownership, verified professional access or admin restriction.

**Impact.** An ordinary account can insert, edit or delete another actor agency/representation/contact details, undermining verified identity and potentially redirecting professional inquiries.

**Recommended fix.** Separate service-role rights from owner/admin rights. Require active verified profile ownership or the correct company membership per row, restrict editable columns and review sensitive representation changes.

**Retest.** Cross-user/person writes fail. Test verified owners, revoked owners, ordinary users, administrators and service identities.

### SEC-12 — Deletion audit records are publicly readable and writable

**Severity:** High
**Validation:** Live policy, grants and maintenance RPC confirmed.

**Source:** [supabase/migrations/20260814181500_grant_deletion_logs.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260814181500_grant_deletion_logs.sql:1). Live-state details are also summarized in the evidence JSON.

**Evidence.** deletion_logs grants ALL to anon/authenticated and has FOR ALL USING(true) WITH CHECK(true). purge_old_deletion_logs() is also SECURITY DEFINER, executable by anon, and has no caller authorization guard.

**Impact.** Anyone can inspect, forge, alter or remove deletion history. This destroys a source of evidence that would otherwise be needed to investigate the other authorization flaws.

**Recommended fix.** Reserve writes for trusted server/trigger paths, restrict reads to an authorized audit view, restrict purge execution and copy security events to an independent append-only log.

**Retest.** Anonymous/ordinary roles cannot read, forge, change, delete or purge audit records. Legitimate deletion events still create immutable evidence.

### SEC-13 — Catalogue-write RPCs bypass intended administrator checks

**Severity:** High
**Validation:** Live function bodies and grants confirmed; mutations not executed.

**Source:** [supabase/migrations/20260904000000_people_aliases.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260904000000_people_aliases.sql:64); [supabase/migrations/20260610000001_restore_admin_access.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20260610000001_restore_admin_access.sql:12). Live-state details are also summarized in the evidence JSON.

**Evidence.** upsert_person_by_name(text,jsonb) is SECURITY DEFINER, callable by anon and inserts people/aliases without a guard. batch_certify_films(uuid[]) and batch_create_films_from_videos(uuid[]) allow authenticated execution and directly change moderation/catalogue records without admin checks. refresh_all_popularity_scores() permits authenticated global maintenance.

**Impact.** Direct database RPC calls bypass protected application APIs, allowing catalogue pollution, moderation bypass or costly whole-table maintenance.

**Recommended fix.** Inventory SECURITY DEFINER functions and restrict execution plus internal caller checks. Authenticated is not equivalent to admin. Revoke PUBLIC where appropriate, fix search_path and maintain a least-privilege function manifest. Review trigger-returning functions separately rather than assuming they are ordinary callable mutations.

**Retest.** An SQL role matrix must reject anonymous/ordinary calls to privileged writes and preserve approved admin/service operations.

### SEC-14 — Public APIs expose paid AI work and an administrative scanner

**Severity:** High
**Validation:** Source-confirmed; paid AI requests not made during this audit.

**Source:** [api/pro-intel.ts](C:/Users/User/Filmdba/lumi/api/pro-intel.ts:1); [api/_lib/pro_intel_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/pro_intel_handler.ts:5); [api/_lib/semantic_search_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/semantic_search_handler.ts:5); [src/routes.ts](C:/Users/User/Filmdba/lumi/src/routes.ts:71); [src/routes/api.run-scanners.tsx](C:/Users/User/Filmdba/lumi/src/routes/api.run-scanners.tsx:74). Live-state details are also summarized in the evidence JSON.

**Evidence.** Pro-intel performs paid generation without session/paid-tier authorization or rate limiting. Semantic search is dispatched before api/ai admin authentication and accepts a caller candidate array without a hard count ceiling. /run-scanners is a public SSR loader using service-role data and can attempt up to 500 paid enrichments. Its output-file write may fail on a read-only host only after work is attempted.

**Impact.** Anonymous callers can consume AI quota/server time, bypass premium UI gates and reach administrative data-processing paths. A protected page or later generic auth check does not protect these branches.

**Recommended fix.** Enforce intended user/tier/admin authorization, shared quotas and budget/concurrency limits. Cap history, query, document and candidate sizes. Move scanners to authorized POST jobs with explicit work limits and durable state; avoid paid work in public GET loaders.

**Retest.** Non-entitled callers incur no AI calls; oversized requests fail cheaply. Quotas survive concurrent workers/cold starts, and scanner GET requests cannot start work.

### SEC-15 — Public image proxy permits SSRF and unbounded buffering

**Severity:** High
**Validation:** IPv4-mapped IPv6 loopback bypass reproduced using mocked HTTP; no internal target contacted.

**Source:** [api/media.ts](C:/Users/User/Filmdba/lumi/api/media.ts:20); [api/media.ts](C:/Users/User/Filmdba/lumi/api/media.ts:72); [api/media.ts](C:/Users/User/Filmdba/lumi/api/media.ts:84). Live-state details are also summarized in the evidence JSON.

**Evidence.** The proxy uses a short hostname string blacklist, without validating resolved IPv4/IPv6 addresses. The local test accepts an IPv4-mapped IPv6 loopback URL. Redirects are followed without revalidating destinations; DNS-to-private targets are not blocked. The 15 MB limit runs after the entire response is buffered.

**Impact.** Untrusted callers can initiate requests toward internal/private services or oversized attacker responses. Image response validation can limit readable output but does not prevent the request itself or blind SSRF. Post-download size checks do not prevent memory exhaustion.

**Recommended fix.** Prefer an explicit host allowlist. Otherwise resolve/validate all addresses, block private/link-local/metadata networks, pin validated connections and recheck every redirect. Apply streaming byte limits, timeouts, concurrency and shared abuse controls.

**Retest.** Block encoded/literal/private/DNS-to-private/redirect-to-private targets and mapped IPv6. Stop oversized/chunked responses during streaming, using local fixtures rather than real internal infrastructure.

### SEC-16 — Attacker SVG can be served as active same-origin content

**Severity:** High
**Validation:** Local mock confirmed raw SVG with a script element is returned inline.

**Source:** [api/media.ts](C:/Users/User/Filmdba/lumi/api/media.ts:90); [api/media.ts](C:/Users/User/Filmdba/lumi/api/media.ts:96). Live-state details are also summarized in the evidence JSON.

**Evidence.** When raster sniffing fails, the proxy still accepts any upstream image/* MIME type, including image/svg+xml. It returns the raw content inline on muvidb.com. The local audit fixture was returned unchanged. nosniff does not disable active SVG behavior.

**Impact.** Opening a crafted proxy URL as a document can execute attacker SVG script in the application origin, exposing origin-scoped application/session storage. This is separate from the SSRF address-validation weakness.

**Recommended fix.** Reject active MIME types and only return validated/re-encoded raster images. If original SVG is necessary, sanitize with a reviewed policy or isolate it on another origin with attachment/sandbox controls. Add a restrictive site CSP as defense in depth.

**Retest.** SVG script, event handlers, foreignObject and external references cannot become executable same-origin content. MIME headers and filename extensions alone must not bypass validation.

### SEC-17 — Privileged credentials and browser cookies are tracked in Git

**Severity:** High
**Validation:** Disclosure confirmed; validity/revocation unverified because the read-only HEAD probe failed.

**Source:** [scratch/add_genres_and_assign.cjs](C:/Users/User/Filmdba/lumi/scratch/add_genres_and_assign.cjs:1); [scratch/assign_remaining_genres.cjs](C:/Users/User/Filmdba/lumi/scratch/assign_remaining_genres.cjs:1); [services/media-extractor/cookies.txt](C:/Users/User/Filmdba/lumi/services/media-extractor/cookies.txt:1). Live-state details are also summarized in the evidence JSON.

**Evidence.** Two tracked scripts contain the same service_role JWT for this Supabase project, with declared expiration in 2036. It differs from the current configured key, which does not establish revocation. The tracked cookie jar contains 13 YouTube cookies including session/authentication cookie names. Values are redacted. Regex matches in embedded artwork and a CSV lint identifier were triaged as false positives.

**Impact.** Anyone with repository/history access may obtain high-privilege database credentials or account session material if still valid. Adding .gitignore later does not remove already tracked files/history. This audit did not prove current cookie validity or historical public repository exposure.

**Recommended fix.** Rotate/revoke exposed legacy credentials through the supported provider process, invalidate affected sessions and remove secrets from files/history in a coordinated cleanup. Use secret management and pre-commit/CI scanning. The Meta token shown earlier in this conversation is an additional exposed credential and should be separately revoked/replaced privately.

**Retest.** Retired credentials are rejected, required jobs work with new values, and full-history/build scans contain no secrets or browser session jars.

### SEC-18 — Desktop clipper trusts arbitrary browser origins without authentication

**Severity:** High
**Validation:** Source-confirmed; requires a running clipper and browser permission/network reachability.

**Source:** [services/local-clipper/main.py](C:/Users/User/Filmdba/lumi/services/local-clipper/main.py:55); [services/local-clipper/main.py](C:/Users/User/Filmdba/lumi/services/local-clipper/main.py:77); [services/local-clipper/main.py](C:/Users/User/Filmdba/lumi/services/local-clipper/main.py:631); [services/local-clipper/main.py](C:/Users/User/Filmdba/lumi/services/local-clipper/main.py:718). Live-state details are also summarized in the evidence JSON.

**Evidence.** Middleware reflects any Origin, grants Access-Control-Allow-Private-Network:true and allows all methods/headers. The defined ALLOWED_ORIGINS list is unused. Clip, batch, render and upload actions have no pairing token or authenticated caller requirement. The upload destination is caller-selected.

**Impact.** If a browser can reach the local service, another website may submit processing jobs, consume CPU/disk/network and read outputs of jobs it creates. Browser local-network permissions may mitigate some cases; this is not claimed to work in every browser. No arbitrary local-file read or shell RCE was demonstrated.

**Recommended fix.** Bind loopback only, enforce exact trusted origins/Host and a per-install high-entropy pairing token, including proper preflight behavior. Restrict upload hosts to approved storage endpoints and bound jobs/media sizes.

**Retest.** Unrelated origins cannot invoke/read clipper operations even after network permission is granted; trusted paired studio requests continue working with tested resource limits.

### SEC-19 — Company profile writes include entitlements and verification; secret column is public

**Severity:** High
**Validation:** Live policy/column privileges confirmed; aggregate snapshot found zero populated company API keys.

**Source:** [supabase/migrations/20261006000000_company_dashboard_and_membership.sql](C:/Users/User/Filmdba/lumi/supabase/migrations/20261006000000_company_dashboard_and_membership.sql:145). Live-state details are also summarized in the evidence JSON.

**Evidence.** The membership UPDATE policy exposes the whole company row without a field allowlist. Live privileges allow authenticated UPDATE of api_tier, and no reviewed guard function protects that field. Public company SELECT includes api_key. There were zero nonempty API-key values in the aggregate snapshot, but the approval function can populate the column later.

**Impact.** An ordinary active company member can set paid/verification/ownership state instead of just public profile text. Future plaintext company API keys would be exposed by public selection. No current company API-key theft or existing populated key is claimed.

**Recommended fix.** Separate public profiles from entitlements, verification, ownership and secrets. Allow only narrow profile-field updates through column grants or a checked RPC. Use privileged operations for sensitive state and store API keys as hashes/scopes in a nonpublic table.

**Retest.** Members can edit approved profile fields but cannot change api_tier, verified, claimed_by or key material. Public responses never disclose keys after company approval.

### SEC-20 — Developer API reports per-key rate limits but does not enforce them

**Severity:** Medium
**Validation:** Source-confirmed; host/WAF quotas were not evaluated.

**Source:** [api/_lib/api_key_guard.ts](C:/Users/User/Filmdba/lumi/api/_lib/api_key_guard.ts:61); [api/v1.ts](C:/Users/User/Filmdba/lumi/api/v1.ts:91); [api/_lib/rateLimit.ts](C:/Users/User/Filmdba/lumi/api/_lib/rateLimit.ts:2). Live-state details are also summarized in the evidence JSON.

**Evidence.** requireApiKey reads/reports rate_limit_per_min but performs no per-key quota/window check. The usage counter is a non-atomic read/modify/write. Other routes use a process-local IP map, which resets on cold starts and is not a shared per-key limiter.

**Impact.** A valid low-tier key can exceed its advertised quota, increasing scraping/resource costs. Concurrent updates can undercount usage and weaken billing/abuse attribution. This does not establish the absence of a hosting-level rate limit.

**Recommended fix.** Implement atomic shared per-key/user quotas and weighted endpoint budgets before expensive work, return 429/Retry-After and increment usage atomically. Keep in-memory maps only as a secondary layer.

**Retest.** Concurrent requests are limited across workers/cold starts; accepted requests are counted accurately and tier allowances are enforced server-side.

### SEC-21 — Secondary credit APIs omit unpublished-film visibility gates

**Severity:** Medium
**Validation:** Source-confirmed; unpublished records not fetched through the public API.

**Source:** [api/_lib/content_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/content_handler.ts:52); [api/_lib/content_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/content_handler.ts:33). Live-state details are also summarized in the evidence JSON.

**Evidence.** person-credits uses a service-role select of *, films(*) without publication filtering or a narrow film-field list. film-credits does not verify that the parent film is published. The main films handler has an explicit gate that these branches omit.

**Impact.** Known people/film IDs linked to unpublished rows can expose drafts/internal fields through a secondary path even when the primary film API hides them.

**Recommended fix.** Apply the same publication/visibility rules to all public service-role reads. Check the parent entity and use explicit field lists; keep draft retrieval on an authorized endpoint.

**Retest.** Draft films remain hidden through detail, credits, filmography, search and SSR paths while published cast/crew stays accessible.

### SEC-22 — Social Studio accepts render messages from unverified windows/origins

**Severity:** Medium
**Validation:** Source-confirmed; browser attack not performed.

**Source:** [src/components/admin/SocialDraftComposer.jsx](C:/Users/User/Filmdba/lumi/src/components/admin/SocialDraftComposer.jsx:803). Live-state details are also summarized in the evidence JSON.

**Evidence.** The OPEN_CUT_RENDER_COMPLETE listener checks event.data.type but not event.origin, event.source, a render nonce or the expected draft identity. Supplied URLs and assets change the administrator draft state.

**Impact.** A page with a reference to the studio window can spoof a render-complete event and substitute/misrepresent draft media. Later save/approval steps determine whether it is published; automatic publication or script execution from this listener alone is not claimed.

**Recommended fix.** Validate exact trusted origins, the specific popup/window reference, draft/variant IDs and a one-time render nonce. Verify asset ownership/type server-side before persistence or publication.

**Retest.** Foreign-origin, wrong-window, wrong-draft and replayed events are ignored; only the intended authenticated render session can attach assets.

### SEC-23 — Public error stacks and incomplete explicit browser-security policy

**Severity:** Medium
**Validation:** Source/configuration confirmed; final host-level headers not independently certified.

**Source:** [api/data.ts](C:/Users/User/Filmdba/lumi/api/data.ts:107); [api/_lib/cors.ts](C:/Users/User/Filmdba/lumi/api/_lib/cors.ts:20); [vercel.json](C:/Users/User/Filmdba/lumi/vercel.json:1). Live-state details are also summarized in the evidence JSON.

**Evidence.** The public router returns exception messages and eight stack frames. Some handlers expose raw provider/database errors. No explicit site CSP/frame-ancestor/referrer policy was found in the reviewed app/deployment configuration. Generic CORS also trusts every *.vercel.app origin; that alone does not grant an attacker a user JWT.

**Impact.** Internal paths/dependency information can assist attacks. Missing explicit browser controls increases the consequences of active-content flaws. Broad preview-origin trust unnecessarily expands permitted origins on applicable endpoints.

**Recommended fix.** Return generic errors with correlation IDs and keep detail in protected logs. Define/test browser policies, starting CSP in report-only mode if needed. Limit previews to owned origins and preserve intended media integrations.

**Retest.** Production errors disclose no stacks, secrets or SQL internals. Header tests cover HTML, errors and active content; unowned preview origins are not allowlisted.

### SEC-24 — Published dependency advisories affect all five npm projects

**Severity:** High
**Validation:** Current npm audit results/lockfiles confirmed; reachability assessed separately.

**Source:** [package-lock.json](C:/Users/User/Filmdba/lumi/package-lock.json:1); [apps/opencut/package-lock.json](C:/Users/User/Filmdba/lumi/apps/opencut/package-lock.json:1); [apps/content-engine/package-lock.json](C:/Users/User/Filmdba/lumi/apps/content-engine/package-lock.json:1); [muvidb-launch-video/package-lock.json](C:/Users/User/Filmdba/lumi/muvidb-launch-video/package-lock.json:1); [scripts/scraper/package-lock.json](C:/Users/User/Filmdba/lumi/scripts/scraper/package-lock.json:1). Live-state details are also summarized in the evidence JSON.

**Evidence.** Root npm audit reports 47 vulnerable package entries, including two critical severity entries. Locked examples: proxy-addr 2.0.7, tar 7.5.13, undici 5.28.4, React Router 7.18.1, Vite 6.4.1 and xlsx 0.18.5. xlsx parses administrator-imported workbooks. Content-engine tooling has sharp 0.35.2; main app sharp 0.35.5 is a different copy. All project counts appear below.

**Impact.** Risk spans runtime, import boundaries and developer/build tooling. Registry severity is not a proven production exploit: tar is dev-only here; proxy-addr requires relevant proxy trust; the reviewed React Router advisory requires RSC mode, which was not found. Vite advisories matter to the Windows dev server bound to all interfaces. Untrusted spreadsheet imports are a real parser boundary.

**Recommended fix.** Prioritize reachable runtime/import packages, then dev tooling, and upgrade in tested batches. Review advisory preconditions instead of blindly applying npm audit fix --force. xlsx needs a maintained upstream-supported distribution/replacement rather than assuming its current npm line has a sufficient bump. Scan every workspace in CI and document narrowly justified exceptions.

**Retest.** Rerun audits/build/regressions, verify deployed lockfile versions, and document any non-reachable advisory exception with its exact prerequisite.

### SEC-25 — Auxiliary service authentication can fail open when secrets are missing

**Severity:** Medium
**Validation:** Configuration-dependent; local Telegram secret is configured, extractor deployment secret state unknown.

**Source:** [services/media-extractor/main.py](C:/Users/User/Filmdba/lumi/services/media-extractor/main.py:11); [services/media-extractor/main.py](C:/Users/User/Filmdba/lumi/services/media-extractor/main.py:129); [api/_lib/telegram_ops_handler.ts](C:/Users/User/Filmdba/lumi/api/_lib/telegram_ops_handler.ts:36). Live-state details are also summarized in the evidence JSON.

**Evidence.** Extractor /extract and /clip check tokens only if EXTRACTOR_SECRET is nonempty. Telegram webhook verification returns true when its secret is missing. Chat IDs inside unsigned JSON do not authenticate a sender. The current local Telegram secret is configured, so this is not reported as an active missing-secret bypass in that runtime.

**Impact.** A deployment configuration omission can silently expose media processing or bot commands rather than failing safely. Actual exploitability depends on missing configuration and network exposure.

**Recommended fix.** Require secrets at startup for exposed deployments and fail protected requests with 503/401 when absent. If necessary, use an explicit loopback-only local-development mode. Verify Telegram secrets and allowed identities on every update path.

**Retest.** Missing secrets and wrong headers cause no processing/mutations; correctly configured bot/extractor requests remain functional.

## Dependency results and reachability

These are vulnerable **package entries reported by npm**, including transitive and development packages. They are not unique CVEs or separately proven application exploits, and are not added to the 25 findings above. The same advisory/package may appear in multiple projects.

| Project | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| root | 2 | 31 | 11 | 3 | 47 |
| opencut | 0 | 6 | 2 | 0 | 8 |
| content engine | 0 | 4 | 0 | 0 | 4 |
| launch video | 0 | 15 | 1 | 2 | 18 |
| scraper | 0 | 2 | 0 | 0 | 2 |

In the root lockfile, 21 flagged package entries have at least one node not marked dev-only. That is a prioritization signal, not proof that each vulnerable API is used.

| Package | Locked version | Relevant context |
|---|---|---|
| proxy-addr | 2.0.7 | Critical advisory involves IP spoofing under affected trusted-proxy configuration. The standalone Express server does not explicitly enable trust proxy. Patch, but do not describe it as demonstrated remote code execution. |
| tar | 7.5.13 | Critical registry classification; dev/tooling dependency here. No public application archive-extraction exploit was demonstrated. |
| undici | 5.28.4 | Direct runtime dependency. Upgrade compatibly and test network clients; proxy/cache/WebSocket advisories need their relevant feature preconditions. |
| React Router | 7.18.1 | Reviewed advisory requires RSC mode. The observed application uses conventional framework SSR and no RSC setup was found. Upgrade to a patched compatible release. |
| Vite | 6.4.1 | Windows development server binds 0.0.0.0; file-read/path advisories deserve developer-machine attention. Production built assets are not themselves a Vite dev server. |
| xlsx | 0.18.5 | Used by AdminImport for workbook parsing. Treat untrusted workbooks as a parser boundary; use a maintained parser/distribution and test compatibility. |
| sharp | 0.35.2 in content-engine tooling | Different from the main app 0.35.5. Fix the affected Wrangler/Miniflare graph; do not incorrectly attribute that version to WhatsApp runtime. |

Full advisory identifiers, URLs, dependency nodes and npm fix suggestions are in the redacted evidence JSON. Review them before making changes: force-fix suggestions may introduce incompatible downgrades or major upgrades.

## Remediation plan

### Immediate containment

- Restrict/drop anonymous escalation and claim-approval RPCs; fix active signup/profile role trust.
- Rotate exposed cron credentials after removing browser references. Review maintenance and publishing operations reachable with the old credential.
- Require authorization on media/linkage writes; disable production sandbox entitlements; reject unsigned payment and WhatsApp callbacks.
- Remove broad public audit/storage writes and authenticated cross-person representation writes.
- Review privileged accounts, company ownership approvals, entitlement changes and unexpected storage objects. This is a recommended investigation, not evidence that compromise occurred.

### Next focused hardening pass

- Centralize explicit full-admin, limited-admin, owner and service authorization. Protect backend operations as well as UI routes.
- Maintain a least-privilege manifest and SQL role tests for every SECURITY DEFINER writer and policy. Fix live state using timestamped migrations and verify that subsequent migrations do not reopen access.
- Separate public company fields from entitlements/secrets. Apply publication checks consistently to service-role reads.
- Replace the image proxy boundary with safe egress, raster-only validation and streaming limits.
- Enforce shared quotas/budgets for AI, uploads, developer keys and expensive jobs.
- Authenticate/pair the local clipper and make auxiliary service authentication fail closed.
- Upgrade dependencies in tested batches, with a specific applicability decision for each unresolved advisory.

### Ongoing controls

- Secret scanning over commits and generated build output; dependency scanning across all lockfiles; a reviewed Python lock/SBOM.
- Deployment assertions for disabled sandbox routes, required webhook secrets and browser-security headers.
- Independent append-only security logs, administrator/ownership-change alerts and regular access reviews.
- Convert these reproduction assertions into rejection tests as fixes land. Include forged webhook, missing-profile, role-source, cross-owner and unauthorized-field cases.

## Controls observed and false positives excluded

The main films API explicitly filters published films. Job-application download signing requires a verified full-admin account. The auth-email verifier implements signature/timestamp checks. Threads OAuth has signed expiring state, stored state consumption and token encryption. Telegram chat allowlisting and a configured local webhook secret exist, although the missing-secret fallback needs hardening. Service-role SSR clients follow a server-only module convention. Administrator log export uses HTML escaping.

Group merge wrappers delegate to guarded inner functions; a rejecting inner call rolls back the wrapper transaction. Their presence alone was not treated as an unchecked merge exploit. Trigger-returning functions with broad EXECUTE were not assumed directly callable as ordinary mutation RPCs. A broad table grant alone was not reported as data exposure where restrictive RLS still blocks it.

The credential regex also matched embedded artwork/base64 and a CSV lint identifier; those candidates were not treated as leaked tokens. No current company API-key exposure is claimed: the aggregate snapshot contained zero populated values. No shell RCE was demonstrated in the local services.

CORS, client routes and names such as “service role access” do not establish authorization; conversely broad CORS alone is not proof that an attacker can obtain a JWT.

## Evidence and local reproduction files

- [Redacted database/dependency evidence](2026-10-15-evidence.json): selected policies/grants, function execution privileges, counts, advisory links and finding metadata. It contains no credential values or user records.
- [Local reproductions](2026-10-15-reproductions.test.ts).
- [Dedicated test configuration](2026-10-15-vitest.config.ts).

Run from the repository root:

```powershell
npx vitest run --config docs/security/2026-10-15-vitest.config.ts
```

At the audited baseline this reports **12 passing demonstrations of insecure behavior**. All database/storage/outbound HTTP dependencies used by the tests are mocked; no real credentials are needed. Do not add them to normal security acceptance tests without reversing assertions as each issue is fixed.

## Primary references

The findings primarily cite repository code and the live catalog snapshot. These references support the security model and selected current advisories:

- [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security): grants and predicates both matter; service-role access bypasses RLS, and user-editable metadata is not authority.
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): validate address resolution and redirects, not only an initial URL string.
- [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- [React Router RSC-specific advisory](https://github.com/advisories/GHSA-qwww-vcr4-c8h2).
- [SheetJS prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and [SheetJS ReDoS](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).

Retest corrected code, actual deployed APIs and the live database role matrix before closing findings. This report is not a guarantee that no other vulnerabilities remain.
