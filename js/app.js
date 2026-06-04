'use strict';

/* -----------------------------------------------------------------------
   APP.JS — Main entry point (consumer version)
   All engine activity is silent. Only status messages shown.
   --------------------------------------------------------------------- */

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let cvReady = false;
let pdfFile = null;

// ── OPENCV LIFECYCLE (silent) ────────────────────────────────────────
function onOpenCvReady() {
  cvReady = true;
  OcrEngine.ensureTesseract().catch(() => {});
}

function onOpenCvFail() {
  cvReady = false;
  OcrEngine.ensureTesseract().catch(() => {});
}

// ── FILE INPUT ───────────────────────────────────────────────────────
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
});

function loadFile(f) {
  pdfFile = f;

  // Show file info in drop zone
  document.getElementById('dzBody').style.display = 'none';
  const dzFile = document.getElementById('dzFile');
  dzFile.style.display = 'flex';
  document.getElementById('dzFileName').textContent = f.name;
  document.getElementById('dzFileSize').textContent = (f.size / 1024).toFixed(1) + ' KB';

  document.getElementById('btnSplit').disabled = false;
}

function clearFile(e) {
  e.stopPropagation();
  pdfFile = null;
  fileInput.value = '';
  document.getElementById('dzBody').style.display = 'flex';
  document.getElementById('dzFile').style.display = 'none';
  document.getElementById('btnSplit').disabled = true;
}

function resetApp() {
  clearFile({ stopPropagation: () => {} });
  UI.showStep('stepUpload');
  UI.setProgress(0, '');
}

// ── MAIN RUN ─────────────────────────────────────────────────────────
async function runSplitter() {
  if (!pdfFile) return;

  UI.setBtnLoading();
  UI.setProgress(5, '');

  const startTime = Date.now();

  // Progress simulation for user feedback
  const stages = [
    { pct: 15, key: 'loading',    delay: 400  },
    { pct: 40, key: 'detecting',  delay: 800  },
    { pct: 70, key: 'splitting',  delay: 1200 },
    { pct: 88, key: 'generating', delay: 1800 },
  ];

  let stageIdx = 0;
  function advanceStage() {
    if (stageIdx < stages.length) {
      const s = stages[stageIdx++];
      setTimeout(() => {
        UI.setProgress(s.pct, '');
        UI.setStatus(s.key);
        advanceStage();
      }, s.delay);
    }
  }
  advanceStage();

  try {
    const result = await PdfProcessor.process(pdfFile, cvReady);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    UI.setProgress(100, '');
    UI.showResult(result.blob, result.count, elapsed);

  } catch (err) {
    console.error('AutoSplit error:', err);
    UI.showStep('stepUpload');
    alert('Something went wrong processing this PDF. Please try another file.');
  }
}
