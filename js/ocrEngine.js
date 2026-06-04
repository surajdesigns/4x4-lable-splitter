'use strict';

/* -----------------------------------------------------------------------
   OCR ENGINE MODULE
   Uses Tesseract.js (loaded from CDN on demand) for barcode text detection
   as an additional signal for label boundary hints.
   Only loads Tesseract when explicitly needed (lazy load).
   --------------------------------------------------------------------- */

const OcrEngine = (() => {

  let tesseractWorker = null;
  let tesseractReady  = false;
  let tesseractFailed = false;

  // Lazy-load Tesseract.js from CDN
  async function ensureTesseract() {
    if (tesseractReady || tesseractFailed) return;

    return new Promise((resolve) => {
      if (window.Tesseract) {
        initWorker().then(resolve);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => initWorker().then(resolve);
      script.onerror = () => {
        UI.log('OCR', 'warn', 'Tesseract.js failed to load — OCR hints disabled');
        tesseractFailed = true;
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  async function initWorker() {
    try {
      tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: () => {} // suppress progress logs
      });
      tesseractReady = true;
      UI.log('OCR', 'ok', 'Tesseract.js worker ready');
    } catch (e) {
      UI.log('OCR', 'warn', 'Tesseract init failed: ' + e.message);
      tesseractFailed = true;
    }
  }

  // ── DETECT BARCODE-LIKE TEXT REGIONS ─────────────────────────────────
  // Returns array of { x, y, w, h } in normalised [0-1] coords
  // representing detected text block clusters that look like tracking IDs
  async function detectBarcodeRegions(canvas) {
    if (!tesseractReady || tesseractFailed) return [];

    try {
      const { data } = await tesseractWorker.recognize(canvas);
      if (!data || !data.blocks) return [];

      const cW = canvas.width;
      const cH = canvas.height;

      // Find text blocks that contain long alphanumeric strings
      // (tracking numbers typically 10-25 chars)
      const TRACKING_RE = /[A-Z0-9]{10,}/;
      const hints = [];

      for (const block of data.blocks) {
        const text = block.text || '';
        if (!TRACKING_RE.test(text)) continue;

        const b = block.bbox;
        // Expand region to estimated label size around barcode
        const cx = (b.x0 + b.x1) / 2 / cW;
        const cy = (b.y0 + b.y1) / 2 / cH;
        const estW = 0.45; // typical label is ~45% of page width
        const estH = 0.35;

        hints.push({
          x:      Math.max(0, cx - estW / 2),
          y:      Math.max(0, cy - estH / 2),
          w:      Math.min(1 - Math.max(0, cx - estW / 2), estW),
          h:      Math.min(1 - Math.max(0, cy - estH / 2), estH),
          area:   estW * estH,
          method: 'ocr'
        });
      }

      return hints;
    } catch (e) {
      UI.log('OCR', 'warn', 'OCR recognition failed: ' + e.message);
      return [];
    }
  }

  async function terminate() {
    if (tesseractWorker) {
      try { await tesseractWorker.terminate(); } catch (e) { /* ignore */ }
      tesseractWorker = null;
      tesseractReady  = false;
    }
  }

  return {
    ensureTesseract,
    detectBarcodeRegions,
    isReady: () => tesseractReady,
    terminate
  };

})();
