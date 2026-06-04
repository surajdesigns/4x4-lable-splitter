'use strict';

/* -----------------------------------------------------------------------
   LABEL DETECTOR MODULE
   Strategy chain:
     1. OpenCV contour detection (if cv ready)
     2. Whitespace segmentation (always run as fallback/backup)
     3. Full-page fallback
   --------------------------------------------------------------------- */

const LabelDetector = (() => {

  // ── OPENCV CONTOUR DETECTION ─────────────────────────────────────────
  function detectLabelsOpenCV(canvas, pageSize) {
    const cv   = window.cv;
    const src  = cv.imread(canvas);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const hier = new cv.Mat();
    const cnts = new cv.MatVector();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

    // Adaptive threshold — handles scanned + digital PDFs
    const thresh = new cv.Mat();
    cv.adaptiveThreshold(
      blur, thresh, 255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 21, 8
    );

    // Morphological close to fill gaps in label borders
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
    const morph  = new cv.Mat();
    cv.morphologyEx(thresh, morph, cv.MORPH_CLOSE, kernel);

    cv.findContours(morph, cnts, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const cW = canvas.width;
    const cH = canvas.height;
    const pageArea = cW * cH;
    const regions  = [];

    for (let i = 0; i < cnts.size(); i++) {
      const cnt  = cnts.get(i);
      const rect = cv.boundingRect(cnt);
      const frac = (rect.width * rect.height) / pageArea;

      if (frac >= 0.02 && frac <= 0.98) {
        const pad = 0.01;
        regions.push({
          x:      Math.max(0, (rect.x / cW) - pad),
          y:      Math.max(0, (rect.y / cH) - pad),
          w:      Math.min(1, (rect.width  / cW) + pad * 2),
          h:      Math.min(1, (rect.height / cH) + pad * 2),
          area:   frac,
          method: 'opencv'
        });
      }
      cnt.delete();
    }

    // Cleanup
    [src, gray, blur, thresh, morph, hier, kernel].forEach(m => {
      try { m.delete(); } catch (e) { /* ignore */ }
    });
    cnts.delete();

    return mergeOverlapping(regions);
  }

  // ── WHITESPACE SEGMENTATION ──────────────────────────────────────────
  function detectLabelsWhitespace(canvas) {
    const ctx  = canvas.getContext('2d', { willReadFrequently: true });
    const cW   = canvas.width;
    const cH   = canvas.height;
    const data = ctx.getImageData(0, 0, cW, cH).data;
    const THRESH = 245;

    function lum(idx) {
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    function rowHasContent(y) {
      for (let x = 0; x < cW; x++) {
        if (lum((y * cW + x) * 4) < THRESH) return true;
      }
      return false;
    }
    function colHasContent(x, y0, y1) {
      for (let y = y0; y < y1; y++) {
        if (lum((y * cW + x) * 4) < THRESH) return true;
      }
      return false;
    }

    // Row profile
    const rowContent = new Uint8Array(cH);
    for (let y = 0; y < cH; y++) rowContent[y] = rowHasContent(y) ? 1 : 0;

    const hBands = findBands(rowContent, Math.floor(cH * 0.01));
    if (hBands.length === 0) return [];

    const regions = [];

    for (const band of hBands) {
      const y0 = band.start;
      const y1 = band.end;

      const colContent = new Uint8Array(cW);
      for (let x = 0; x < cW; x++) colContent[x] = colHasContent(x, y0, y1) ? 1 : 0;

      const vBands = findBands(colContent, Math.floor(cW * 0.01));

      if (vBands.length === 0) {
        regions.push({
          x: 0, y: y0 / cH,
          w: 1,  h: (y1 - y0) / cH,
          area: (y1 - y0) / cH,
          method: 'whitespace'
        });
      } else {
        for (const vb of vBands) {
          const pad = 0.008;
          regions.push({
            x:      Math.max(0, vb.start / cW - pad),
            y:      Math.max(0, y0 / cH - pad),
            w:      Math.min(1, (vb.end - vb.start) / cW + pad * 2),
            h:      Math.min(1, (y1 - y0) / cH + pad * 2),
            area:   ((vb.end - vb.start) / cW) * ((y1 - y0) / cH),
            method: 'whitespace'
          });
        }
      }
    }

    return mergeOverlapping(regions);
  }

  // ── FIND CONTENT BANDS (1D) ──────────────────────────────────────────
  function findBands(arr, minGap) {
    const bands = [];
    let inBand = false, start = 0, gapCount = 0;
    const minLen = Math.floor(arr.length * 0.04);

    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) {
        if (!inBand) { inBand = true; start = i; }
        gapCount = 0;
      } else {
        if (inBand) {
          gapCount++;
          if (gapCount > minGap) {
            if (i - start - gapCount >= minLen) {
              bands.push({ start, end: i - gapCount });
            }
            inBand = false; gapCount = 0;
          }
        }
      }
    }
    if (inBand && arr.length - start >= minLen) {
      bands.push({ start, end: arr.length - 1 });
    }
    return bands;
  }

  // ── MERGE OVERLAPPING (IoU-based NMS) ────────────────────────────────
  function mergeOverlapping(regions) {
    if (regions.length <= 1) return regions;

    regions.sort((a, b) => b.area - a.area);
    const keep = [];
    const used = new Array(regions.length).fill(false);

    for (let i = 0; i < regions.length; i++) {
      if (used[i]) continue;
      keep.push(regions[i]);
      for (let j = i + 1; j < regions.length; j++) {
        if (!used[j] && iou(regions[i], regions[j]) > 0.3) used[j] = true;
      }
    }
    return keep;
  }

  function iou(a, b) {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inter = ix * iy;
    const union = a.w * a.h + b.w * b.h - inter;
    return union > 0 ? inter / union : 0;
  }

  // ── PICK BEST REGION SET ─────────────────────────────────────────────
  function pickBest(cvRegions, wsRegions) {
    const score = regs => regs.reduce((acc, r) => {
      const ratio = r.h > 0 ? r.w / r.h : 0;
      return acc + ((ratio > 0.3 && ratio < 3.5) ? 1 : 0.2);
    }, 0);
    return score(cvRegions) >= score(wsRegions) ? cvRegions : wsRegions;
  }

  // ── VALIDATE REGIONS ─────────────────────────────────────────────────
  function validate(regions, canvas) {
    const cW = canvas.width;
    const cH = canvas.height;

    return regions.filter(r => {
      const wPx  = r.w * cW;
      const hPx  = r.h * cH;
      const ratio = wPx / hPx;
      if (wPx < 40 || hPx < 40)    return false;
      if (r.area < 0.015)           return false;
      if (ratio < 0.15 || ratio > 8) return false;
      return true;
    });
  }

  // ── FULL-PAGE FALLBACK ───────────────────────────────────────────────
  function fullPage() {
    return [{ x: 0.005, y: 0.005, w: 0.99, h: 0.99, area: 0.98, method: 'fullpage' }];
  }

  // ── PUBLIC: DETECT ALL ───────────────────────────────────────────────
  function detect(canvas, pageSize, cvReady) {
    let regions = [];

    // 1. OpenCV (if available)
    if (cvReady && window.cv) {
      try {
        regions = detectLabelsOpenCV(canvas, pageSize);
        UI.log('CV', 'info', `OpenCV: ${regions.length} candidate(s)`);
      } catch (e) {
        UI.log('CV', 'warn', 'OpenCV error: ' + e.message);
        regions = [];
      }
    }

    // 2. Whitespace segmentation
    const wsRegions = detectLabelsWhitespace(canvas);
    UI.log('CV', 'info', `Whitespace: ${wsRegions.length} candidate(s)`);

    // 3. Merge strategies
    if (regions.length === 0) {
      regions = wsRegions;
    } else {
      regions = pickBest(regions, wsRegions);
    }

    // 4. Validate
    regions = validate(regions, canvas);

    // 5. Full-page fallback
    if (regions.length === 0) {
      UI.log('CV', 'warn', 'No regions — full page fallback');
      regions = fullPage();
    }

    return regions;
  }

  return { detect };

})();
