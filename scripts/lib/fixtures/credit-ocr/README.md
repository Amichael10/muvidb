# Credit OCR regression images

User-provided credit screenshots from the reported extraction failures. The
cast expectations are transcribed from the images, not from an OCR run.

Run the complete image-to-credit checks on a worker with ffmpeg, ffprobe and
English Tesseract installed:

```powershell
$env:CREDIT_OCR_INTEGRATION = '1'
npm.cmd test -- scripts/lib/credit_roll_parser.test.ts scripts/lib/credit_frame_ocr.test.ts
```

The two cast fixtures require all 16 actor/character pairs, no additional
people, and enough confidence for the harvester's single-frame admission gate.
The Royal Arts crew fixtures check section boundaries and specific role
assignments. This is not a claim of 90% accuracy across unseen videos: some
crew spellings and small headings still need manual review.

Inspect any fixture using the same OCR path as the worker, without database
writes:

```powershell
npx.cmd tsx scripts/validate_credit_frames.ts scripts/lib/fixtures/credit-ocr/dotted-crew.png
```

Preprocessing follows the rescaling and page-segmentation considerations in
the [Tesseract quality guide](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html).
