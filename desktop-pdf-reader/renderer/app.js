import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';

let pdfDoc = null;
let pageNum = 1;
let scale = 1.2;
let rotation = 0;
let rendering = false;
let pendingPage = null;

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const canvasScroll = document.getElementById('canvas-scroll');
const dropzone = document.getElementById('dropzone');
const docControls = document.getElementById('doc-controls');
const filenameEl = document.getElementById('filename');
const statusEl = document.getElementById('status');
const pageInput = document.getElementById('pageinput');
const countEl = document.getElementById('count');
const zoomLabel = document.getElementById('zoom-label');

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function showViewer() {
  dropzone.style.display = 'none';
  canvasScroll.style.display = 'flex';
  docControls.style.display = 'flex';
}

function showDropzone() {
  dropzone.style.display = 'flex';
  canvasScroll.style.display = 'none';
  docControls.style.display = 'none';
}

async function loadArrayBuffer(data, name) {
  setStatus('Wczytywanie...');
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      standardFontDataUrl: './vendor/pdfjs/standard_fonts/',
      isEvalSupported: false,
    });
    pdfDoc = await loadingTask.promise;
    pageNum = 1;
    scale = 1.2;
    rotation = 0;
    filenameEl.textContent = name;
    filenameEl.title = name;
    countEl.textContent = pdfDoc.numPages;
    pageInput.value = 1;
    pageInput.max = pdfDoc.numPages;
    setStatus('');
    showViewer();
    renderPage(pageNum);
  } catch (err) {
    console.error(err);
    setStatus('Blad wczytywania pliku PDF: ' + (err && err.message ? err.message : err));
  }
}

function renderPage(num) {
  rendering = true;
  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale, rotation });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderTask = page.render({ canvasContext: ctx, viewport });
    renderTask.promise.then(() => {
      rendering = false;
      if (pendingPage !== null) {
        const p = pendingPage;
        pendingPage = null;
        renderPage(p);
      }
    });
  });
  pageInput.value = num;
  zoomLabel.textContent = Math.round(scale * 100) + '%';
}

function queueRenderPage(num) {
  if (rendering) {
    pendingPage = num;
  } else {
    renderPage(num);
  }
}

function goPrev() {
  if (!pdfDoc || pageNum <= 1) return;
  pageNum--;
  queueRenderPage(pageNum);
}
function goNext() {
  if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
  pageNum++;
  queueRenderPage(pageNum);
}
function goToPage(n) {
  if (!pdfDoc) return;
  n = Math.max(1, Math.min(pdfDoc.numPages, parseInt(n, 10) || 1));
  pageNum = n;
  queueRenderPage(pageNum);
}
function zoomIn() {
  scale = Math.min(4, scale + 0.2);
  queueRenderPage(pageNum);
}
function zoomOut() {
  scale = Math.max(0.3, scale - 0.2);
  queueRenderPage(pageNum);
}
function rotate() {
  rotation = (rotation + 90) % 360;
  queueRenderPage(pageNum);
}
async function fitWidth() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pageNum);
  const unscaled = page.getViewport({ scale: 1, rotation });
  const containerWidth = canvasScroll.clientWidth - 56;
  scale = Math.max(0.3, containerWidth / unscaled.width);
  queueRenderPage(pageNum);
}
function closeDocument() {
  pdfDoc = null;
  showDropzone();
  setStatus('');
}

function handleFile(file) {
  if (!file) return;
  const isPdf = (file.type && file.type === 'application/pdf') || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    setStatus('Wybierz plik w formacie PDF.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => loadArrayBuffer(new Uint8Array(e.target.result), file.name);
  reader.onerror = () => setStatus('Nie udalo sie odczytac pliku.');
  reader.readAsArrayBuffer(file);
}

document.getElementById('btn-open').addEventListener('click', () => window.electronAPI.openFileDialog());
document.getElementById('btn-prev').addEventListener('click', goPrev);
document.getElementById('btn-next').addEventListener('click', goNext);
document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
document.getElementById('btn-fit').addEventListener('click', fitWidth);
document.getElementById('btn-rotate').addEventListener('click', rotate);
document.getElementById('btn-print').addEventListener('click', () => window.print());
document.getElementById('btn-close').addEventListener('click', closeDocument);
pageInput.addEventListener('change', (e) => goToPage(e.target.value));

dropzone.addEventListener('click', () => window.electronAPI.openFileDialog());

['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');
  })
);
dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(f);
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (!pdfDoc) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext();
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPrev();
  if (e.key === '+' || e.key === '=') zoomIn();
  if (e.key === '-') zoomOut();
});

window.electronAPI.onOpenPdf((payload) => {
  loadArrayBuffer(payload.data, payload.name);
});
