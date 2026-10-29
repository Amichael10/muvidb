# Project Agent Guidelines & Rules

## Credit Extraction & Harvester Reconciliation Rule

When performing local OCR (via `local_ocr_extractor.py`, `cast_extractor.py`, automated scripts, or the Admin Credit Harvest UI) for any movie that the credit harvester or a previous ingestion pass has already enriched:

1. **NEVER add the same person afresh as a duplicate entry.**
2. **ALWAYS replace or update the existing person in-place correctly.**
3. **Check Existing Records**: Look up existing entries by `person_id`, `matched_person_id`, or fuzzy/alias name matching in both `credits` and `credit_candidates`.
4. **Zero-Duplicate Actor Guarantee**: An actor must only have a single credit row per movie. Enrich existing actor rows with character names rather than inserting duplicate credits.
5. **Preserve Hierarchy & Cleanliness**: Update existing credits in-place (`character_name`, `role`, `billing_order`) whenever local OCR provides clearer or more specific readings.

## Social Studio Editorial Formats & Reel Rule

1. **Actor Spotlight & Behind The Camera are ALWAYS Multi-Slide 4:5 Carousels (6 Slides)** — NEVER static single-image cards:
   - **Actor Spotlight & Filmography** (`actor_spotlight` / `filmography-simple-v1` / `you-know-the-face-simple-v1`, e.g., Lateef Adedimeji) and **Behind The Camera** (`behind_the_camera` / `behind-camera-simple-v1`, e.g., Akinfolarin) are **6-slide 4:5 (1080×1350) carousels** (Cover portrait → Creative Mind bio → 4-poster Filmography grid → Cinematic Journey → New Vanguard → Celebration closing slide).
2. **9:16 Reel Auto-Generation (+ Trending Audio) is Strictly Limited to**:
   - **Now Streaming** (`where_to_watch` / `streaming_alert`)
   - **New & Upcoming Release** (`upcoming_movie` / `new_release`)
3. **Other Editorial Formats**:
   - **Weekend Watchlist** (`weekend_watchlist`): Multi-slide 4:5 carousel (5 slides).
   - **What The Critics Say** (`critics_say`): Multi-slide 4:5 carousel.
   - **What's On Stage & Theatre** (`whats_on_stage`): Verified 4:5 portrait poster (`poster-only`).
   - **Nollywood Debate & Conversation** (`film_conversation`): 4:5 debate graphic.
