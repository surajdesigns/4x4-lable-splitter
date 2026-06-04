# AutoSplit — Courier Label Intelligence Engine

**Split multi-label PDFs into individual 4×6 thermal-ready pages — entirely in the browser.**

No server. No upload. No API key. Works offline after first load.

---

## Features

- **OpenCV.js** contour detection for label boundary identification
- **Whitespace segmentation** fallback for clean digital PDFs
- **Tesseract.js OCR** hint layer (lazy-loaded) for tracking number detection
- **PDF-Lib** for pixel-perfect PDF cropping and output
- **PDF.js** for high-fidelity page rendering
- Outputs 4×6 inch pages (standard thermal label size)
- Supports: Delhivery, Xpressbees, BlueDart, DTDC, Amazon, Ekart, and all courier formats

---

## Detection Strategy (priority chain)

```
1. OpenCV contour detection
        ↓ (if fails or finds nothing)
2. Whitespace segmentation
        ↓ (OCR hints run in parallel)
3. Tesseract.js barcode/tracking-number region hints
        ↓ (if all fail)
4. Full-page fallback (entire page = 1 label)
```

---

## Project Structure

```
autosplit/
├── index.html              # Main entry point
├── css/
│   └── style.css           # Full stylesheet
├── js/
│   ├── app.js              # Entry orchestrator, file input, CV lifecycle
│   ├── ui.js               # Logging, pipeline steps, progress, results
│   ├── labelDetector.js    # OpenCV + whitespace detection engine
│   ├── ocrEngine.js        # Tesseract.js lazy-load + barcode hints
│   └── pdfProcessor.js     # Render → detect → crop → export pipeline
└── README.md
```

---

## GitHub Pages Deployment

### Method 1: Direct Upload

1. Create a new GitHub repository (e.g. `autosplit`)
2. Upload all files maintaining the folder structure
3. Go to **Settings → Pages**
4. Source: `Deploy from a branch` → `main` → `/ (root)`
5. Click **Save**
6. Visit `https://yourusername.github.io/autosplit/`

### Method 2: Git CLI

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/yourusername/autosplit.git
git push -u origin main
```

Then enable GitHub Pages in repository Settings.

---

## Local Development

No build step required. Just open `index.html` in a browser.

**Note:** OpenCV.js loads from CDN (~8MB). On first load it may take 5–10 seconds depending on connection speed.

For local file:// access, some browsers block cross-origin scripts. Use a simple static server:

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx, no install needed)
npx serve .
```

Then open `http://localhost:8080`

---

## CDN Dependencies

All loaded from public CDNs — no npm install required:

| Library | Version | CDN |
|---------|---------|-----|
| PDF.js | 3.11.174 | cdnjs.cloudflare.com |
| PDF-Lib | 1.17.1 | unpkg.com |
| OpenCV.js | 4.8.0 | docs.opencv.org |
| Tesseract.js | 5.x | unpkg.com (lazy-loaded) |
| Google Fonts | Syne + DM Mono | fonts.googleapis.com |

---

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 15+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Mobile Chrome | ✅ Full |
| Mobile Safari | ✅ Full |

---

## License

MIT — use freely, modify freely, ship freely.
