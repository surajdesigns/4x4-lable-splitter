'use strict';

/* -----------------------------------------------------------------------
   APP.JS — Main entry point
   Wires: file input, OpenCV lifecycle, run button → PdfProcessor
   --------------------------------------------------------------------- */

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── STATE ───────────────────────────────────────────────────────────────
let cvReady  = false;
let pdfFile  = null;

// ── OPENCV LIFECYCLE ────────────────────────────────────────────────────
function onOpenCvReady() {
  cvReady = true;
  document.getElementById('cv-loading').classList.add('hidden');
  UI.log('SYS', 'ok', 'OpenCV.js loaded — computer vision engine ready');

  // Pre-load Tesseract in background (non-blocking)
  OcrEngine.ensureTesseract().catch(() => {});
}

function onOpenCvFail() {
  document.getElementById('cv-loading').classList.add('hidden');
  UI.log('SYS', 'warn', 'OpenCV.js failed — using whitespace segmentation only');
  cvReady = false;
  // Still try Tesseract
  OcrEngine.ensureTesseract().catch(() => {});
}

// ── FILE INPUT ──────────────────────────────────────────────────────────
const fileInput = document.getElementById('fileInput');
const dropZone  = document.getElementById('dropZone');

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') loadFile(f);
  else UI.log('SYS', 'error', 'Please drop a valid PDF file');
});

function loadFile(f) {
  pdfFile = f;
  document.getElementById('dzTitle').textContent    = f.name;
  document.getElementById('dzFilename').textContent =
    `${(f.size / 1024).toFixed(1)} KB — ready for processing`;
  UI.log('IO', 'info', `File loaded: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`);
  UI.resetResult();
}

// ── MAIN RUN ────────────────────────────────────────────────────────────
async function runSplitter() {
  if (!pdfFile) {
    UI.log('SYS', 'error', 'No file selected — please upload a PDF first');
    return;
  }

  UI.setBtnLoading();
  UI.resetResult();
  UI.resetPipeline();
  UI.setProgress(0, 'Starting...');
  UI.showStatsRow();

  const startTime = Date.now();

  try {
    const result = await PdfProcessor.process(pdfFile, cvReady);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    UI.setStats(undefined, result.count, elapsed + 's');
    UI.log('SYS', 'ok', `✓ Complete — ${result.count} labels extracted in ${elapsed}s`);
    UI.setProgress(100, 'Done');
    UI.pipDone('export');
    UI.showResult(result.blob, result.count, elapsed);

  } catch (err) {
    UI.log('SYS', 'error', 'Fatal: ' + err.message);
    UI.setProgress(0, 'Error');
    console.error(err);
  } finally {
    UI.setBtnReady();
  }
}
