@echo off
echo ====================================================
echo Starting Full Catalog Credit Enrichment...
echo ====================================================
npx tsx scripts/enrich_all_people_credits.ts --limit=200
echo ====================================================
echo Batch complete! Run again anytime to process the next batch.
pause
