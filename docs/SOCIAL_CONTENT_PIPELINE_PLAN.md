# MuviDB Social Content Pipeline and Meta Publishing Plan

Last updated: 2026-08-25

Status: **Implementation in progress. Telegram structured intake and approval inbox are implemented; Instagram, Facebook, Threads, and TikTok publishing adapters are implemented and still depend on healthy provider authorization.**

This is the canonical handoff for expanding MuviDB's existing Social Studio into:

1. a Telegram-based social-source intake bot;
2. a database-driven rolling content pipeline;
3. human review and approval;
4. live publishing to Instagram, Facebook Pages, and Threads.

Do not put access tokens, app secrets, webhook secrets, or encryption keys in this document.

## Read first

Before making changes, read:

- `docs/SOCIAL_STUDIO_PHASE1.md` for the existing implementation and its gotchas;
- `docs/social-templates/README.md` for the authored card designs;
- `api/_lib/social_studio.ts` for generation, review, scheduling, queueing, and the mock publisher;
- `api/_lib/telegram.ts` and `api/_lib/telegram_ops_handler.ts` for the existing bot infrastructure;
- `src/pages/admin/AdminSocialStudio.jsx` for the current admin UI;
- `supabase/migrations/20260730211114_social_studio_foundation.sql` and
  `supabase/migrations/20260814000000_editorial_pipeline_foundation.sql` for the two overlapping social schemas.

Preserve unrelated dirty-worktree changes. Use additive migrations. Implement and verify on staging before enabling production publishing.

## Product decisions already made

- MuviDB Social Studio is the source of truth. Notion is not the primary editorial database.
- Initial live platforms: Instagram, Facebook Pages, and Threads.
- Telegram is the source-intake shortcut: forward a link, screenshot, image, caption, or voice-note instruction to the existing MuviDB bot.
- Arbitrary Instagram-account monitoring is not a V1 dependency.
- A source can be saved without immediately spending AI/rendering resources.
- The system must add MuviDB database context and create an original editorial angle; it must not merely paraphrase another account's caption.
- Every draft requires human approval.
- Approval and publication remain distinct actions:
  - Approve only;
  - Approve and post now;
  - Approve and schedule;
  - Request changes;
  - Reject.
- Live provider calls remain feature-gated until OAuth, staging tests, and an explicit production enablement decision.
- If a social URL cannot be read, the bot asks for a screenshot or pasted caption. It must not invent content from an inaccessible URL.
- Source-media reuse requires an explicit rights decision. Default to MuviDB-owned, licensed, official promotional, or generated branded assets.

## Current implementation

The existing Social Studio already includes:

- content-item and platform-variant states;
- frozen source snapshots;
- actor and upcoming-film draft generation;
- branded PNG rendering in three aspect ratios;
- review, approval, rejection, and reopening;
- scheduling and cancellation;
- deterministic publish-job idempotency keys;
- retries, dead-letter states, and event history;
- asset retention;
- a mock platform adapter;
- a full-admin Social Studio page.

The pipeline has previously been verified end to end as:

`generate -> submit -> approve -> schedule -> mock publish`

The Threads implementation now includes:

- admin-only OAuth initiation and callback handling;
- signed, expiring, single-use OAuth state;
- short-lived to long-lived token exchange and automatic near-expiry refresh;
- AES-256-GCM token encryption at rest with server-only token columns;
- sanitized connection status in Social Studio;
- connect, reconnect, and disconnect controls;
- live text and public-image publishing through the existing queue;
- provider permalink lookup;
- retry classification and a no-automatic-retry state for ambiguous publish results;
- independent `SOCIAL_THREADS_PUBLISH_ENABLED` protection in addition to global live mode.

The Telegram intake implementation now includes:

- allowlisted forwarding of links, text, photos, and videos;
- YouTube Short recognition and a playable-MP4 return action through the existing Render extractor;
- Telegram `file_id` reuse so repeated downloads do not consume extraction compute;
- structured AI preparation for film records, critic reviews, and credits;
- news, social-draft, ignore, and approval-inbox actions;
- an admin-only Telegram Approval Inbox inside Social Studio;
- canonical, editable Social Studio drafts for Instagram, Facebook, Threads, and TikTok;
- source-artwork attachment when the forwarded thumbnail is a safe public URL;
- a three-hashtag maximum in generated Telegram draft copy;
- editable extracted facts with source evidence retained;
- catalogue writes only after full-admin approval;
- duplicate protection for social drafts and film-title/year matches;
- required synopsis validation for films and required film/quote attribution for critic reviews.

No new serverless route or third content model was added. Telegram intake continues to use
`social_news_events`; workflow state and extracted data live in its `metadata` JSON until the
admin applies the item. The canonical social publisher continues to use
`social_content_items`, `social_platform_variants`, `social_assets`, and
`social_publish_jobs`.

Known boundary: the bot can return a playable YouTube Short inside the private Telegram chat,
but that downloaded video is not automatically republished. The Social Studio draft uses a
safe public source thumbnail when one exists and requires an administrator to confirm media
rights or replace the artwork before approval. Native video ingestion and watermarking should
be added only with an explicit rights-confirmation step and durable media storage.

## Important schema issue

There are two partially overlapping models:

1. `social_content_items`, `social_platform_variants`, `social_assets`, and `social_publish_jobs`;
2. `social_calendar`, `social_drafts`, and the newer editorial pipeline tables.

Do not add a third content model for Telegram intake.

Before expanding the pipeline, document a field-by-field mapping and select one canonical lifecycle. The preferred direction is:

- `social_content_items` owns the publishable editorial item and status;
- `social_platform_variants` owns final per-platform copy and publication status;
- `social_assets` owns rendered/exported media;
- `social_publish_jobs` owns delivery attempts;
- `social_calendar` may remain the planning layer, referencing the canonical content item;
- duplicated `social_drafts` responsibilities should be migrated or reduced rather than extended.

Migration must preserve existing rows and URLs.

## Target user experience

### Intake

The owner sees a useful Instagram, Facebook, Threads, X, YouTube, or web post and shares it to the MuviDB Telegram bot.

The bot responds with a classification and actions:

- Create post;
- Save as upcoming;
- Save as announcement;
- Save as trailer;
- Save as casting;
- Save as streaming;
- Save as cinema release;
- Save as industry commentary;
- Save for later;
- Ignore.

The classifier may recommend a category, but the owner can change it.

### Retrieval fallback

1. Attempt to retrieve public metadata, caption, Open Graph data, and accessible media metadata.
2. If the source is blocked or incomplete, ask for a screenshot, caption, or image.
3. Associate the follow-up message with the pending intake session.
4. Never infer facts solely from an inaccessible URL.

### Enrichment

The pipeline should:

- classify relevance before generation;
- extract film, person, company, platform, date, and release information;
- match entities against MuviDB;
- show ambiguous matches for human selection;
- enrich the source with verified MuviDB credits and URLs;
- record source evidence and confidence per claim;
- detect duplicate subject/angle/asset combinations;
- recommend a slot in the rolling calendar;
- generate Instagram, Facebook, and Threads variants;
- render or select appropriate assets;
- send the result to review.

### Telegram result

Example:

```text
Draft ready
Film: Example Film
Category: Upcoming release
Matched MuviDB record: /films/example-film
Confidence: High
Suggested time: Thursday, 18:30 WAT
Platforms: Instagram, Facebook, Threads

[Preview] [Approve only] [Post now] [Schedule] [Request changes] [Reject]
```

`Post now` must show a final platform-and-asset confirmation before creating immediate publish jobs.

## Editorial calendar

Use a rolling four-week plan rather than a frozen monthly batch:

- 60% evergreen database content;
- 25% flexible/timely content;
- 15% experimental or community content.

Evergreen slots can be generated ahead. Timely intake can recommend replacing a flexible slot, but never silently remove an approved item.

Duplicate checks must consider subject, angle, hook, selected credits, asset, CTA, and recent history. Reusing the same actor with a genuinely different story is allowed.

## Content safety and quality

Every draft needs:

- original source URL or uploaded evidence;
- matched MuviDB entity IDs;
- source snapshot;
- factual claims with confidence/provenance;
- reviewer warnings for missing or conflicting data;
- rights status for every asset;
- a content-expiry or recheck time for release dates and time-sensitive claims;
- generated-copy version and prompt version;
- approval actor and timestamp;
- final published copy and provider permalink.

Reject or route to manual review when the source is primarily:

- birthday/personal content unless deliberately requested;
- relationships or private life;
- fashion/outfits without a film angle;
- unrelated advertising;
- generic motivation;
- unverified rumours;
- an inaccessible link with no supporting screenshot/caption.

User-facing failures must be plain-language messages, never raw database or provider diagnostics.

## Telegram security

- Accept privileged intake/review commands only from allowlisted Telegram user/chat IDs.
- Verify webhook authenticity and use the existing bot secret handling.
- Telegram callback payloads must contain opaque IDs, not secrets or editable content.
- Re-read the current database state before approval or publishing; stale callback buttons must fail safely.
- Make approval callbacks single-use/idempotent.
- Require a final confirmation for public posting.
- Keep a full event trail with Telegram actor/chat/message IDs where appropriate.
- Do not allow Telegram to bypass server-side full-admin authorization for Social Studio actions.

## Meta app registration

Two Meta apps are expected.

### App A: MuviDB Threads Publisher

Current status as of 2026-08-18:

- App created in Meta for Developers.
- App name: `MuviDB Threads Publisher`.
- Threads use case selected.
- App is unpublished.
- `THREAD_APP_ID` and `THREAD_APP_SECRET` have been added to the deployment environment by the owner; values are not in source control.
- OAuth routes, encrypted token persistence, token refresh, connection UI, and the live Threads adapter are implemented locally.
- Database migration `20260818000000_social_connection_encrypted_tokens.sql` is pending staging application.

Next setup and staging actions:

1. Configure/request `threads_basic` and `threads_content_publish` in the Threads use case.
2. Add the MuviDB Threads account as a tester while the app is unpublished, then accept the invitation from that Threads account.
3. Apply the encrypted-token/OAuth-state migration to staging.
4. Set `THREAD_REDIRECT_URI` to the exact staging callback shown by Social Studio and add that exact URI to Meta.
5. Deploy with `SOCIAL_STUDIO_ENABLED=true`, `SOCIAL_PUBLISH_MODE=mock`, and `SOCIAL_THREADS_PUBLISH_ENABLED=false`.
6. Connect the account from Admin -> Social Studio and verify the returned username and token expiry.
7. Exercise generation, approval, and scheduling in mock mode.
8. For one controlled Threads test, set `SOCIAL_PUBLISH_MODE=live` and `SOCIAL_THREADS_PUBLISH_ENABLED=true`, then queue only a Threads variant.
9. Verify the public post, stored provider ID/permalink, event history, and lack of duplicate posts.
10. Return flags to safe values until explicit production enablement.

Do not click **Become a Tech Provider** for this owner-operated integration.

### App B: MuviDB Meta Publisher

Create separately for Instagram and Facebook Pages.

Preferred registration:

- choose `Other -> Business` when Meta offers it;
- otherwise choose the Facebook Login use case and connect the MuviDB Business Portfolio;
- add/configure Instagram API and Facebook Pages access.

Planned permissions:

Instagram:

- `instagram_business_basic`;
- `instagram_business_content_publish`.

Facebook Pages:

- `pages_show_list`;
- `pages_read_engagement`;
- `pages_manage_posts`.

The exact permission set must be rechecked against Meta's current dashboard and official documentation immediately before App Review.

## Secret and token design

Server configuration names (names only; values must stay in the deployment secret store):

- `THREAD_APP_ID`;
- `THREAD_APP_SECRET`;
- `THREAD_REDIRECT_URI`;
- `THREADS_GRAPH_API_VERSION`;
- `THREAD_OAUTH_STATE_SECRET`;
- `SOCIAL_TOKEN_ENCRYPTION_KEY`;
- `META_APP_ID`;
- `META_APP_SECRET`;
- existing publisher/cron authentication secret.

Do not store provider access tokens directly in browser storage, source control, logs, Telegram messages, or unencrypted table columns.

Threads tokens are encrypted by the server with AES-256-GCM in `social_connections`; browser roles cannot select the ciphertext, IV, or authentication tag. Separate `SOCIAL_TOKEN_ENCRYPTION_KEY` and `THREAD_OAUTH_STATE_SECRET` values are required so rotating the Meta app secret does not invalidate stored tokens or OAuth state signatures. Store token expiry, granted scopes, account IDs, connection health, and last refresh separately from the encrypted token.

OAuth requirements:

- random, expiring, single-use `state` bound to the initiating admin session;
- PKCE where the provider supports/requires it;
- exact redirect URI allowlist;
- server-side code exchange;
- token refresh before expiry;
- reconnect-required state and admin/Telegram notification;
- webhook signature verification;
- sensitive-value redaction in logs and errors.

## Publishing architecture

Retain the existing adapter interface and queue. Add provider-specific adapters rather than branching provider HTTP calls throughout the application.

Each adapter must:

- validate caption and media constraints before queueing;
- create/upload provider media containers;
- wait or poll for media readiness where required;
- publish using the connected account token;
- return provider publish ID and permalink;
- classify provider failures as retryable, terminal, or reconnect-required;
- never retry a successful publish;
- use existing idempotency guards;
- preserve the final submitted payload for audit;
- reconcile ambiguous timeouts before retrying to avoid duplicate public posts.

Approval should enqueue work; it should not hold an HTTP request open while a provider processes media.

## Feature flags

Keep provider rollout independently controllable. Suggested flags:

- existing `SOCIAL_STUDIO_ENABLED`;
- existing `SOCIAL_PUBLISH_MODE=mock|live`;
- `SOCIAL_TELEGRAM_INTAKE_ENABLED`;
- `SOCIAL_THREADS_PUBLISH_ENABLED`;
- `SOCIAL_INSTAGRAM_PUBLISH_ENABLED`;
- `SOCIAL_FACEBOOK_PUBLISH_ENABLED`.

Live mode should still refuse a platform whose individual flag or healthy connection is absent.

## Implementation sequence

### Phase 0: Reconcile foundations

- Map the two current social/editorial schemas.
- Choose the canonical lifecycle without deleting existing data.
- Extend platform types for the three initial live providers as necessary.
- Document source-intake and evidence fields.
- Add tests before migrating existing rows.

### Phase 1: Telegram intake

- Add allowlisted content-intake commands and callbacks to the existing bot.
- Support link, text, photo/screenshot, and follow-up instruction messages.
- Add expiring pending-intake sessions.
- Implement Save versus Create Post.
- Add accessible-source retrieval and screenshot fallback.
- Classify relevance/category and persist evidence.
- Create an admin-reviewable candidate without publishing.

### Phase 2: Content pipeline

- Match films, people, and companies.
- Add ambiguity resolution.
- Add provenance/confidence and rights checks.
- Implement rolling calendar rules and duplicate-angle detection.
- Generate Instagram, Facebook, and Threads copy.
- Reuse the existing renderer and authored templates.
- Add Telegram and Social Studio previews.

### Phase 3: Provider-neutral approval and queueing

- Add Approve only, Post now, Schedule, Request changes, and Reject.
- Add Telegram final confirmation.
- Add immediate jobs through the existing queue.
- Add connection-health preflight and plain-language failures.
- Ensure double clicks and webhook retries cannot double-post.

### Phase 4: Threads live adapter — code complete, staging verification pending

- [x] Complete OAuth and token refresh.
- [ ] Connect the owner-operated Threads account on staging.
- [ ] Publish controlled text and image variants in staging/test mode.
- [x] Reconcile the provider permalink when available and stop automatic retries when the publish result is ambiguous.
- Keep production flag off until explicit approval.

### Phase 5: Instagram and Facebook live adapters

- Create/configure the second Meta app.
- Complete Facebook Page and Instagram Professional-account OAuth.
- Implement image, carousel, and supported video flows incrementally.
- Add provider container/status handling.
- Complete App Review evidence and reviewer test instructions.
- Enable one platform at a time.

### Phase 6: Reporting and optimization

- Fetch permitted insights for MuviDB-owned posts.
- Attribute clicks using platform/campaign UTM parameters.
- Report saves, shares, reach, engagement, profile visits, and MuviDB page visits where available.
- Feed performance into recommendations, never directly into unreviewed publishing.

## Testing requirements

Minimum automated and staging coverage:

- accessible social URL;
- blocked Instagram URL followed by screenshot;
- screenshot-only intake;
- irrelevant/personal-post rejection;
- ambiguous film/person match;
- no matching MuviDB record;
- existing active candidate/draft duplication;
- same subject with a different valid angle;
- missing or unapproved asset rights;
- caption length and platform validation;
- approve only;
- post-now confirmation;
- scheduled publish;
- cancellation before processing;
- double approval/double callback;
- expired token and reconnect notification;
- rate limit and retry backoff;
- provider accepts request but status remains processing;
- network timeout after a possibly successful publish;
- terminal provider rejection;
- audit record and external permalink;
- no raw provider/database error exposed to the owner.

End-to-end tests must use provider test accounts or unpublished app-role/tester accounts before any MuviDB production account.

## Definition of done for the first usable release

- Owner forwards a post or screenshot to Telegram.
- Bot classifies or asks for missing evidence.
- Candidate is stored with source and category.
- MuviDB entity matching and factual enrichment complete.
- Instagram, Facebook, and Threads drafts are generated.
- Branded assets are generated or rights-approved assets selected.
- Draft is reviewable in Social Studio and Telegram.
- Owner can approve, reject, request changes, post now, or schedule.
- Mock publishing completes end to end on staging.
- Live adapters remain disabled until their OAuth/test checklist passes.
- Every state change is auditable and user-facing errors are non-technical.

## Deployment rules

- No production provider calls from developer machines.
- No secrets in commits, screenshots, Telegram, or this document.
- Database changes are additive and applied to staging first.
- Existing mock mode remains the safe default.
- Test one live platform at a time using a controlled post.
- Production enabling requires an explicit user instruction after the final preview and test evidence are shown.
- Update this document after each implementation slice so another agent can continue without reconstructing decisions.

## Immediate next actions

1. Apply `supabase/migrations/20260818000000_social_connection_encrypted_tokens.sql` to staging.
2. Set a separate `SOCIAL_TOKEN_ENCRYPTION_KEY` and `THREAD_OAUTH_STATE_SECRET` in staging.
3. Add the exact staging `THREAD_REDIRECT_URI` to Meta's Threads OAuth settings.
4. Confirm/accept the MuviDB Threads account's tester invitation.
5. Deploy with the live publishing flag off and complete the OAuth connection from Social Studio.
6. Run one controlled Threads-only staging publication after explicit approval.
7. Continue Telegram intake and the Instagram/Facebook app as separate implementation slices.
