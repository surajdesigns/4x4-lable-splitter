'use strict';

/* -----------------------------------------------------------------------
   UI MODULE — consumer-facing only
   No logs, no pipeline steps, no debug output
   --------------------------------------------------------------------- */

const UI = (() => {

  // Status messages shown to user (never technical details)
  const STATUS = {
    loading:    ['Analyzing PDF...',      'This usually takes a few seconds'],
    detecting:  ['Detecting labels...',   'Finding label boundaries'],
    splitting:  ['Splitting labels...',   'Almost there'],
    generating: ['Generating PDF...',     'Preparing your download'],
    done:       ['Done',                  ''],
  };

  // Internal silent logger (console only — user never sees this)
  function log(tag, level, msg) {
    // Silently log to console for debugging if needed
    // console.log(`[${tag}] ${msg}`);
  }

  // ── PIPELINE (silent — no UI) ────────────────────────────────────────
  function pipActive(id) { /* silent */ }
  function pipDone(id)   { /* silent */ }
  function pipError(id)  { /* silent */ }
  function resetPipeline() { /* silent */ }

  // ── PROGRESS ─────────────────────────────────────────────────────────
  function setProgress(pct, label) {
    const fill = document.getElementById('progressFill');
    const pctEl = document.getElementById('progressPct');
    if (fill)  fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  }

  function setStatus(key, customSub) {
    const [status, sub] = STATUS[key] || [key, ''];
    const statusEl = document.getElementById('procStatus');
    const subEl    = document.getElementById('procSub');
    if (statusEl) statusEl.textContent = status;
    if (subEl)    subEl.textContent = customSub !== undefined ? customSub : sub;
  }

  // ── STATS (silent — no stats panel) ─────────────────────────────────
  function setStats(pages, labels, time) { /* no-op */ }
  function showStatsRow() { /* no-op */ }

  // ── STEP TRANSITIONS ─────────────────────────────────────────────────
  function showStep(id) {
    ['stepUpload', 'stepProcessing', 'stepDone'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? 'flex' : 'none';
    });
  }

  // ── RESULT ───────────────────────────────────────────────────────────
  function showResult(blob, count, elapsed) {
    const url = URL.createObjectURL(blob);
    const ts  = Date.now();

    const dl = document.getElementById('btnDownload');
    if (dl) {
      dl.href     = url;
      dl.download = `split_labels_${ts}.pdf`;
    }

    const title = document.getElementById('doneTitle');
    const sub   = document.getElementById('doneSub');
    if (title) title.textContent = `${count} label${count !== 1 ? 's' : ''} extracted`;
    if (sub)   sub.textContent   = `${elapsed}s · 4×6 · ready to print`;

    showStep('stepDone');

    // Auto-trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `split_labels_${ts}.pdf`;
    a.click();
  }

  function resetResult() { /* handled by resetApp() in app.js */ }

  // ── BUTTON STATE ─────────────────────────────────────────────────────
  function setBtnLoading() {
    showStep('stepProcessing');
    setProgress(0, '');
    setStatus('loading');
  }

  function setBtnReady() { /* step handled by showStep */ }

  return {
    log,
    pipActive, pipDone, pipError, resetPipeline,
    setProgress, setStatus,
    setStats, showStatsRow,
    showResult, resetResult,
    setBtnLoading, setBtnReady,
    showStep
  };

})();
