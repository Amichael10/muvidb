@echo off
echo ====================================================
echo Running Requested Catalogue Sync Operations...
echo Platforms: Prime Video, NolliStream, Kava, Docuth, EbonyONPlus
echo ====================================================

echo.
echo [1/5] Running Prime Video Sync...
npx tsx scripts/prime_sync.ts

echo.
echo [2/5] Running NolliStream Sync...
npx tsx scripts/scrape_nollistream_public.ts

echo.
echo [3/5] Running Kava Sync...
npx tsx scripts/sync_feed_kappa.ts

echo.
echo [4/5] Running Docuth Sync...
npx tsx scripts/sync_feed_zeta.ts

echo.
echo [5/5] Running EbonyONPlus Sync...
npx tsx scripts/ebonylife_sync.ts

echo.
echo ====================================================
echo All Sync Operations Completed!
echo ====================================================
pause
