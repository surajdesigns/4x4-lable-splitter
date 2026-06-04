'use strict';

/* -----------------------------------------------------------------------
   PDF PROCESSOR MODULE
   Orchestrates: render → detect → crop → embed → export
   --------------------------------------------------------------------- */

const PdfProcessor = (() => {

  const IN_TO_PT    = 72;
  const TARGET_W_IN = 4;
  const TARGET_H_IN = 6;
  const RENDER_SCALE = 2.5;

  // ── RENDER PAGE → CANVAS ─────────────────────────────────────────────
  async function renderPage(pdfJsDoc, pageNum, scale) {
    const page     = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.width   = Math.floor(viewport.width);
    canvas.height  = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // ── EMBED CROPPED REGION INTO OUTPUT PDF ─────────────────────────────
  async function embedRegion(outPdf, srcPage, reg, pageSize, pageNum, ri) {
    const cropBox = {
      left:   reg.x * pageSize.width,
      bottom: (1 - reg.y - reg.h) * pageSize.height,
      right:  (reg.x + reg.w) * pageSize.width,
      top:    (1 - reg.y) * pageSize.height
    };

    // Clamp to page bounds
    cropBox.left   = Math.max(0, cropBox.left);
    cropBox.bottom = Math.max(0, cropBox.bottom);
    cropBox.right  = Math.min(pageSize.width,  cropBox.right);
    cropBox.top    = Math.min(pageSize.height, cropBox.top);

    const rW = cropBox.right  - cropBox.left;
    const rH = cropBox.top    - cropBox.bottom;

    if (rW < 20 || rH < 20) {
      // silent;
      return false;
    }

    const [embedded] = await outPdf.embedPages(
      [srcPage],
      [{ left: cropBox.left, bottom: cropBox.bottom, right: cropBox.right, top: cropBox.top }]
    );

    // Create 4×6 output page
    const outPage = outPdf.addPage([TARGET_W_IN * IN_TO_PT, TARGET_H_IN * IN_TO_PT]);
    const pw = outPage.getWidth();
    const ph = outPage.getHeight();

    // Scale to fit, maintain aspect ratio
    const scale = Math.min(pw / embedded.width, ph / embedded.height);
    const dw    = embedded.width  * scale;
    const dh    = embedded.height * scale;
    const dx    = (pw - dw) / 2;
    const dy    = (ph - dh) / 2;

    outPage.drawPage(embedded, { x: dx, y: dy, width: dw, height: dh });
    return true;
  }

  // ── MAIN PROCESS FUNCTION ─────────────────────────────────────────────
  async function process(file, cvReady) {
    const arrayBuffer = await file.arrayBuffer();

    // Load both PDF.js (for rendering) and PDF-Lib (for writing) in parallel
    // silent;
    const [pdfJsDoc, pdfLibSrc] = await Promise.all([
      pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise,
      PDFLib.PDFDocument.load(arrayBuffer.slice(0))
    ]);

    const numPages = pdfJsDoc.numPages;
    UI.setStats(numPages, 0, undefined);
    // silent;

    const outPdf = await PDFLib.PDFDocument.create();
    let totalLabels = 0;

    for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
      const pageNum = pageIdx + 1;
      const pct = (pageIdx / numPages) * 85;
      UI.setProgress(pct, `Processing page ${pageNum} of ${numPages}`);
      // silent;

      // ── RENDER ───────────────────────────────────────────────────────
      UI.pipActive('render');
      const canvas = await renderPage(pdfJsDoc, pageNum, RENDER_SCALE);
      UI.pipDone('render');

      // ── DETECT ───────────────────────────────────────────────────────
      UI.pipActive('detect');
      UI.pipActive('contour');
      UI.pipActive('barcode');

      const srcPage  = pdfLibSrc.getPage(pageIdx);
      const pageSize = srcPage.getSize();

      let regions = LabelDetector.detect(canvas, pageSize, cvReady);

      // OCR hint layer (runs if Tesseract ready, non-blocking)
      if (OcrEngine.isReady()) {
        // silent;
        const ocrHints = await OcrEngine.detectBarcodeRegions(canvas);
        if (ocrHints.length > 0) {
          // silent;
          // Merge OCR hints only if they'd increase count
          if (ocrHints.length > regions.length) {
            regions = ocrHints;
          }
        }
      }

      UI.pipDone('contour');
      UI.pipDone('barcode');
      UI.pipActive('validate');
      // silent;
      UI.pipDone('validate');

      // ── CROP & EMBED ─────────────────────────────────────────────────
      UI.pipActive('crop');

      for (let ri = 0; ri < regions.length; ri++) {
        try {
          const ok = await embedRegion(outPdf, srcPage, regions[ri], pageSize, pageNum, ri);
          if (ok) {
            totalLabels++;
            UI.setStats(undefined, totalLabels, undefined);
          }
        } catch (e) {
          // silent;
        }
      }

      UI.pipDone('crop');

      // Free canvas memory
      canvas.width  = 1;
      canvas.height = 1;
    }

    // ── EXPORT ───────────────────────────────────────────────────────────
    UI.pipActive('export');
    UI.setProgress(95, 'Generating output PDF...');
    // silent;

    const pdfBytes = await outPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    return { blob, count: totalLabels };
  }

  return { process };

})();
