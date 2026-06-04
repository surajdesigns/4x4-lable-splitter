'use strict';

/* -----------------------------------------------------------------------
   UI MODULE — logging, pipeline steps, progress bar
   --------------------------------------------------------------------- */

const UI = (() => {

  // ── LOGGING ─────────────────────────────────────────────────────────
  function log(tag, level, msg) {
    const t = document.getElementById('terminal');
    const ts = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML =
      `<span class="log-ts">${ts}</span>` +
      `<span class="log-tag ${level}">${tag}</span>` +
      `<span class="log-msg">${msg}</span>`;
    t.appendChild(line);
    t.scrollTop = t.scrollHeight;
  }

  // ── PIPELINE STEPS ───────────────────────────────────────────────────
  const STEPS = ['render', 'detect', 'contour', 'barcode', 'validate', 'crop', 'export'];

  function pipSet(id, state) {
    const el = document.getElementById('pip-' + id);
    if (!el) return;
    el.className = 'pip-step ' + (state || '');
  }
  function pipActive(id) { pipSet(id, 'active'); }
  function pipDone(id)   { pipSet(id, 'done'); }
  function pipError(id)  { pipSet(id, 'error'); }
  function resetPipeline() { STEPS.forEach(s => pipSet(s, '')); }

  // ── PROGRESS ─────────────────────────────────────────────────────────
  function setProgress(pct, label) {
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progPct').textContent = Math.round(pct) + '%';
    document.getElementById('progLabel').textContent = label;
  }

  // ── STATS ────────────────────────────────────────────────────────────
  function setStats(pages, labels, time) {
    if (pages  !== undefined) document.getElementById('statPages').textContent  = pages;
    if (labels !== undefined) document.getElementById('statLabels').textContent = labels;
    if (time   !== undefined) document.getElementById('statTime').textContent   = time;
  }

  function showStatsRow() {
    document.getElementById('statsRow').classList.remove('hidden');
  }

  // ── RESULT CARD ──────────────────────────────────────────────────────
  function showResult(blob, count, elapsed) {
    const url  = URL.createObjectURL(blob);
    const card = document.getElementById('resultCard');
    const dl   = document.getElementById('resultDl');
    const ts   = Date.now();

    dl.href     = url;
    dl.download = `split_labels_${ts}.pdf`;
    document.getElementById('resultTitle').textContent = `${count} label(s) extracted successfully`;
    document.getElementById('resultSub').textContent   = `Processed in ${elapsed}s · 4×6 thermal-ready pages`;
    card.classList.add('visible');

    // Auto-trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `split_labels_${ts}.pdf`;
    a.click();
  }

  function resetResult() {
    document.getElementById('resultCard').classList.remove('visible');
  }

  // ── BUTTON STATE ─────────────────────────────────────────────────────
  function setBtnLoading() {
    const btn = document.getElementById('btnSplit');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div><span>Analyzing PDF...</span>`;
  }

  function setBtnReady() {
    const btn = document.getElementById('btnSplit');
    btn.disabled = false;
    btn.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      <span>Split Labels</span>`;
  }

  return {
    log,
    pipActive, pipDone, pipError, resetPipeline,
    setProgress,
    setStats, showStatsRow,
    showResult, resetResult,
    setBtnLoading, setBtnReady
  };

})();
