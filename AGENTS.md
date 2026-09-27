# Project Agent Guidelines & Rules

## Credit Extraction & Harvester Reconciliation Rule

When performing local OCR (via `local_ocr_extractor.py`, `cast_extractor.py`, automated scripts, or the Admin Credit Harvest UI) for any movie that the credit harvester or a previous ingestion pass has already enriched:

1. **NEVER add the same person afresh as a duplicate entry.**
2. **ALWAYS replace or update the existing person in-place correctly.**
3. **Check Existing Records**: Look up existing entries by `person_id`, `matched_person_id`, or fuzzy/alias name matching in both `credits` and `credit_candidates`.
4. **Zero-Duplicate Actor Guarantee**: An actor must only have a single credit row per movie. Enrich existing actor rows with character names rather than inserting duplicate credits.
5. **Preserve Hierarchy & Cleanliness**: Update existing credits in-place (`character_name`, `role`, `billing_order`) whenever local OCR provides clearer or more specific readings.
