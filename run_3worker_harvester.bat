@echo off
echo ================================================================
echo 🚀 AUTOMATED 3-WORKER CREDIT HARVESTER & CONSENSUS DAEMON
echo.
echo Worker 1: Harvester (Video Tail/Head OCR Extraction)
echo Worker 2: Validation (YouTube Title & Description Metadata)
echo Worker 3: Application (Consensus Reconciliation & Auto-Commit)
echo ================================================================
echo.

cd /d "%~dp0"
npx tsx scripts/run_automated_credit_harvester.ts %*

pause
