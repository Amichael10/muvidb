import fs from 'fs';
import path from 'path';
import { ingest2025Data } from './ingest_2025_yearbook';

async function runPipeline() {
  const ocrFile = path.join(process.cwd(), 'outputs', 'yearbook_2025_easyocr_raw.json');

  if (!fs.existsSync(ocrFile)) {
    console.log('OCR file not ready yet. Awaiting parse_2025_pages_ocr.py completion...');
    return;
  }

  const rawOcr = JSON.parse(fs.readFileSync(ocrFile, 'utf8'));
  console.log('Processing raw OCR blocks into structured 2025 data...');

  const movies: any[] = [];
  const actorRankings: any[] = [];

  // Parse page 42 / 43 (Top 2025 Nollywood movies)
  // Parse page 81 / 82 / 83 / 84 (Top 2025 Lead & Supporting Actors/Actresses)

  // Execute ingestion
  await ingest2025Data(movies, actorRankings);
}

runPipeline();
