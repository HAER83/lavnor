import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';
import { EventBus, PDFLinkService, PDFFindController, PDFViewer, ScrollMode } from './vendor/pdfjs/web/pdf_viewer.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';

const $ = (id) => document.getElementById(id);

const viewerContainer = $('viewerContainer');
const viewerEl = $('viewer');
const dropzone = $('dropzone');
const filenameEl = $('filename');
const statusEl = $('status');
const docControls = $('doc-controls');
const pageInput = $('pageinput');
const countEl = $('count');
const zoomLabel = $('zoom-label');
const fitSelect = $('fit-select');
const scrollSelect = $('scroll-select');
const sidebar = $('sidebar');
const findbar = $('findbar');
const findInput = $('find-input');
const findCount = $('find-count');
const markToolbar = $('mark-toolbar');

const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const findController = new PDFFindController({ eventBus, linkService });

const pdfViewer = new PDFViewer({
  container: viewerContainer,
  viewer: viewerEl,
  eventBus,
  linkService,
  findController,
  textLayerMode: 1,
});
linkService.setViewer(pdfViewer);

let pdfDocument = null;
let currentFilePath = null;
let currentFileName = '';
const textContentCache = new Map();
let highlightsByPage = {};
let restoringSession = false;
let sessionSaveTimer = null;

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function showViewer() {
  dropzone.classList.remove('visible');
  docControls.style.display = 'flex';
}
function showDropzone() {
  dropzone.classList.add('visible');
  docControls.style.display = 'none';
}

/* ---------- session persistence ---------- */

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('lexpdf.session') || 'null');
  } catch {
    return null;
  }
}

function saveSessionNow() {
  if (!currentFilePath || restoringSession) return;
  const data = {
    filePath: currentFilePath,
    page: pdfViewer.currentPageNumber || 1,
    scaleValue: pdfViewer.currentScaleValue,
    scale: pdfViewer.currentScale,
    rotation: pdfViewer.pagesRotation,
    scrollMode: pdfViewer.scrollMode,
    sidebarOpen: !sidebar.classList.contains('hidden'),
  };
  localStorage.setItem('lexpdf.session', JSON.stringify(data));
}

function saveSessionDebounced() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSessionNow, 400);
}

function highlightsKey(filePath) {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    hash = (hash * 31 + filePath.charCodeAt(i)) | 0;
  }
  return 'lexpdf.marks.' + hash;
}

function loadHighlights(filePath) {
  try {
    return JSON.parse(localStorage.getItem(highlightsKey(filePath)) || '{}');
  } catch {
    return {};
  }
}
function saveHighlights() {
  if (!currentFilePath) return;
  localStorage.setItem(highlightsKey(currentFilePath), JSON.stringify(highlightsByPage));
}

/* ---------- loading ---------- */

async function loadArrayBuffer(data, name, filePath, restoreState) {
  setStatus('Wczytywanie...');
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      standardFontDataUrl: './vendor/pdfjs/standard_fonts/',
      isEvalSupported: false,
    });

    loadingTask.onPassword = (updatePassword, reason) => {
      showPasswordPrompt(reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD, updatePassword, () => {
        loadingTask.destroy();
        setStatus('Anulowano otwieranie pliku.');
      });
    };

    pdfDocument = await loadingTask.promise;
    hidePasswordPrompt();

    currentFilePath = filePath || null;
    currentFileName = name;
    textContentCache.clear();
    highlightsByPage = currentFilePath ? loadHighlights(currentFilePath) : {};

    filenameEl.textContent = name;
    filenameEl.title = name;
    countEl.textContent = pdfDocument.numPages;
    pageInput.max = pdfDocument.numPages;

    pdfViewer.setDocument(pdfDocument);
    linkService.setDocument(pdfDocument, null);
    findController.setDocument(pdfDocument);

    setStatus('');
    showViewer();

    buildThumbnails();
    buildOutline();
    buildAttachments();
    clearSearchPanel();

    eventBus.on('pagesinit', function onInit() {
      if (restoreState) {
        applyRestoredState(restoreState);
      } else {
        pdfViewer.currentScaleValue = 'page-width';
      }
    }, { once: true });
  } catch (err) {
    if (err && err.name === 'PasswordException') return;
    console.error(err);
    setStatus('Blad wczytywania pliku PDF: ' + (err && err.message ? err.message : err));
  }
}

function applyRestoredState(state) {
  restoringSession = true;
  pdfViewer.pagesRotation = state.rotation || 0;
  pdfViewer.scrollMode = state.scrollMode ?? ScrollMode.VERTICAL;
  scrollSelect.value = String(pdfViewer.scrollMode);
  pdfViewer.currentScaleValue = state.scaleValue || 'page-width';
  if (state.page) pdfViewer.currentPageNumber = state.page;
  setTimeout(() => { restoringSession = false; }, 300);
}

async function tryRestoreLastSession() {
  const session = loadSession();
  if (!session || !session.filePath) return;
  try {
    const result = await window.electronAPI.readPath(session.filePath);
    await loadArrayBuffer(result.data, result.name, result.path, session);
    if (session.sidebarOpen) sidebar.classList.remove('hidden');
  } catch {
    /* file no longer available; ignore */
  }
}

/* ---------- password modal ---------- */

function showPasswordPrompt(isRetry, onSubmit, onCancel) {
  const modal = $('password-modal');
  const input = $('password-input');
  const error = $('password-error');
  modal.classList.remove('hidden');
  error.textContent = isRetry ? 'Nieprawidlowe haslo, sprobuj ponownie.' : '';
  input.value = '';
  input.focus();

  function submit() {
    onSubmit(input.value);
  }
  function cancel() {
    modal.classList.add('hidden');
    cleanup();
    onCancel();
  }
  function onKey(e) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') cancel();
  }
  function cleanup() {
    $('password-ok').removeEventListener('click', submit);
    $('password-cancel').removeEventListener('click', cancel);
    input.removeEventListener('keydown', onKey);
  }
  $('password-ok').addEventListener('click', submit);
  $('password-cancel').addEventListener('click', cancel);
  input.addEventListener('keydown', onKey);
}
function hidePasswordPrompt() {
  $('password-modal').classList.add('hidden');
}

/* ---------- toolbar wiring ---------- */

$('btn-open').addEventListener('click', () => window.electronAPI.openFileDialog());
dropzone.addEventListener('click', () => window.electronAPI.openFileDialog());

$('btn-sidebar').addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
  saveSessionDebounced();
});

document.querySelectorAll('.sidebar-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $('panel-' + tab.dataset.tab).classList.add('active');
  });
});

$('btn-prev').addEventListener('click', () => { pdfViewer.currentPageNumber--; });
$('btn-next').addEventListener('click', () => { pdfViewer.currentPageNumber++; });
pageInput.addEventListener('change', (e) => {
  const n = Math.max(1, Math.min(pdfDocument.numPages, parseInt(e.target.value, 10) || 1));
  pdfViewer.currentPageNumber = n;
});

$('btn-zoom-in').addEventListener('click', () => { pdfViewer.currentScale = Math.min(5, pdfViewer.currentScale + 0.1); });
$('btn-zoom-out').addEventListener('click', () => { pdfViewer.currentScale = Math.max(0.25, pdfViewer.currentScale - 0.1); });
fitSelect.addEventListener('change', (e) => { pdfViewer.currentScaleValue = e.target.value; });
scrollSelect.addEventListener('change', (e) => { pdfViewer.scrollMode = parseInt(e.target.value, 10); });
$('btn-rotate').addEventListener('click', () => { pdfViewer.pagesRotation = (pdfViewer.pagesRotation + 90) % 360; });

$('btn-dark-doc').addEventListener('click', (e) => {
  viewerEl.classList.toggle('dark-doc');
  e.currentTarget.classList.toggle('active');
});

viewerContainer.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.1 : -0.1;
  pdfViewer.currentScale = Math.max(0.25, Math.min(5, pdfViewer.currentScale + delta));
}, { passive: false });

eventBus.on('pagechanging', (evt) => {
  pageInput.value = evt.pageNumber;
  updateCurrentThumbnail(evt.pageNumber);
  saveSessionDebounced();
});
eventBus.on('scalechanging', (evt) => {
  zoomLabel.textContent = Math.round(evt.scale * 100) + '%';
  saveSessionDebounced();
});
eventBus.on('rotationchanging', () => saveSessionDebounced());
eventBus.on('scrollmodechanged', () => saveSessionDebounced());

/* ---------- print ---------- */

async function printDocument() {
  if (!pdfDocument) return;
  setStatus('Przygotowywanie wydruku...');
  const printContainer = document.createElement('div');
  printContainer.id = 'print-container';
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const viewport = page.getViewport({ scale: 2, rotation: pdfViewer.pagesRotation });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    printContainer.appendChild(canvas);
  }
  document.body.appendChild(printContainer);
  document.body.classList.add('printing');
  window.print();
  document.body.classList.remove('printing');
  document.body.removeChild(printContainer);
  setStatus('');
}
$('btn-print').addEventListener('click', printDocument);
window.electronAPI.onTriggerPrint(printDocument);

const printStyle = document.createElement('style');
printStyle.textContent = `
@media print {
  body > *:not(.printing #print-container) { display: none !important; }
  #print-container { display: block !important; }
  #print-container canvas { width: 100%; display: block; page-break-after: always; }
}
#print-container { display: none; }
`;
document.head.appendChild(printStyle);

/* ---------- thumbnails ---------- */

const thumbObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      renderThumbnail(entry.target);
      thumbObserver.unobserve(entry.target);
    }
  });
}, { root: $('panel-thumbs'), rootMargin: '200px' });

function buildThumbnails() {
  const panel = $('panel-thumbs');
  panel.innerHTML = '';
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    item.dataset.page = i;
    item.innerHTML = `<div class="thumb-canvas-wrap"></div><div class="thumb-label">${i}</div>`;
    item.addEventListener('click', () => { pdfViewer.currentPageNumber = i; });
    panel.appendChild(item);
    thumbObserver.observe(item);
  }
}

async function renderThumbnail(item) {
  const pageNumber = parseInt(item.dataset.page, 10);
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 0.2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const wrap = item.querySelector('.thumb-canvas-wrap');
  wrap.innerHTML = '';
  wrap.appendChild(canvas);
}

function updateCurrentThumbnail(pageNumber) {
  document.querySelectorAll('.thumb-item.current').forEach((el) => el.classList.remove('current'));
  const el = document.querySelector(`.thumb-item[data-page="${pageNumber}"]`);
  if (el) {
    el.classList.add('current');
    el.scrollIntoView({ block: 'nearest' });
  }
}

/* ---------- outline ---------- */

async function buildOutline() {
  const panel = $('panel-outline');
  panel.innerHTML = '';
  const outline = await pdfDocument.getOutline();
  if (!outline || outline.length === 0) {
    panel.innerHTML = '<div class="sidebar-empty">Brak spisu tresci w tym dokumencie.</div>';
    return;
  }
  panel.appendChild(renderOutlineLevel(outline));
}

function renderOutlineLevel(items) {
  const ul = document.createElement('div');
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'outline-item';
    row.textContent = item.title;
    row.addEventListener('click', async () => {
      if (item.dest) {
        const dest = typeof item.dest === 'string' ? await pdfDocument.getDestination(item.dest) : item.dest;
        if (dest) linkService.goToDestination(dest);
      }
    });
    ul.appendChild(row);
    if (item.items && item.items.length) {
      const children = renderOutlineLevel(item.items);
      children.className = 'outline-children';
      ul.appendChild(children);
    }
  });
  return ul;
}

/* ---------- attachments ---------- */

async function buildAttachments() {
  const panel = $('panel-attachments');
  panel.innerHTML = '';
  const attachments = await pdfDocument.getAttachments();
  if (!attachments) {
    panel.innerHTML = '<div class="sidebar-empty">Brak zalacznikow w tym dokumencie.</div>';
    return;
  }
  const names = Object.keys(attachments);
  if (names.length === 0) {
    panel.innerHTML = '<div class="sidebar-empty">Brak zalacznikow w tym dokumencie.</div>';
    return;
  }
  names.forEach((name) => {
    const att = attachments[name];
    const row = document.createElement('div');
    row.className = 'attachment-item';
    row.innerHTML = `<span class="attachment-name" title="${att.filename}">${att.filename}</span>
      <button class="attachment-save">Zapisz</button>`;
    row.querySelector('.attachment-save').addEventListener('click', async () => {
      await window.electronAPI.saveAttachment(att.filename, att.content);
    });
    panel.appendChild(row);
  });
}

/* ---------- search ---------- */

async function getPageText(pageNumber) {
  if (textContentCache.has(pageNumber)) return textContentCache.get(pageNumber);
  const page = await pdfDocument.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items.map((it) => it.str).join(' ');
  textContentCache.set(pageNumber, text);
  return text;
}

function clearSearchPanel() {
  $('panel-search').innerHTML = '<div class="sidebar-empty">Wpisz fraze i wcisnij Ctrl+Shift+F.</div>';
}

function openFindBar() {
  findbar.classList.remove('hidden');
  findInput.focus();
  findInput.select();
}
function closeFindBar() {
  findbar.classList.add('hidden');
  eventBus.dispatch('findbarclose', { source: window });
}

function dispatchFind(type, findPrevious) {
  eventBus.dispatch('find', {
    source: window,
    type: type || '',
    query: findInput.value,
    caseSensitive: $('find-case').checked,
    entireWord: $('find-word').checked,
    highlightAll: true,
    findPrevious: !!findPrevious,
    matchDiacritics: false,
  });
}

findInput.addEventListener('input', () => dispatchFind(''));
$('find-next').addEventListener('click', () => dispatchFind('again', false));
$('find-prev').addEventListener('click', () => dispatchFind('again', true));
$('find-case').addEventListener('change', () => dispatchFind(''));
$('find-word').addEventListener('change', () => dispatchFind(''));
$('find-close').addEventListener('click', closeFindBar);
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dispatchFind('again', e.shiftKey);
  if (e.key === 'Escape') closeFindBar();
});

eventBus.on('updatefindmatchescount', (evt) => {
  const { current, total } = evt.matchesCount;
  findCount.textContent = total ? `${current}/${total}` : '0/0';
});
eventBus.on('updatefindcontrolstate', (evt) => {
  findbar.classList.toggle('not-found', evt.state === 2);
});

async function runSnippetSearch(query) {
  const panel = $('panel-search');
  panel.innerHTML = '';
  if (!query) { clearSearchPanel(); return; }
  const caseSensitive = $('find-case').checked;
  const flags = caseSensitive ? 'g' : 'gi';
  let re;
  try {
    re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch {
    return;
  }
  let found = 0;
  for (let p = 1; p <= pdfDocument.numPages; p++) {
    const text = await getPageText(p);
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      found++;
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + m[0].length + 40);
      const before = text.slice(start, m.index);
      const match = text.slice(m.index, m.index + m[0].length);
      const after = text.slice(m.index + m[0].length, end);
      const row = document.createElement('div');
      row.className = 'search-result';
      row.innerHTML = `<span class="page-tag">Strona ${p}</span>&hellip;${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}&hellip;`;
      row.addEventListener('click', () => {
        pdfViewer.currentPageNumber = p;
        findInput.value = query;
        dispatchFind('');
        findbar.classList.remove('hidden');
      });
      panel.appendChild(row);
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  if (found === 0) panel.innerHTML = '<div class="sidebar-empty">Brak wynikow.</div>';
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

document.addEventListener('keydown', (e) => {
  if (!pdfDocument) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFindBar();
    dispatchFind('');
  } else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    sidebar.classList.remove('hidden');
    document.querySelector('.sidebar-tab[data-tab="search"]').click();
    runSnippetSearch(findInput.value || prompt('Szukana fraza:') || '');
  } else if (mod && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    printDocument();
  }
});

/* ---------- highlighting ---------- */

function pageDivFor(node) {
  let el = node;
  while (el && el.nodeType === 1 && !el.classList.contains('page')) el = el.parentElement;
  return el;
}

function currentSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const pageDiv = pageDivFor(range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement);
  if (!pageDiv) return null;
  const pageNumber = parseInt(pageDiv.dataset.pageNumber, 10);
  const rects = Array.from(range.getClientRects());
  if (rects.length === 0) return null;
  const text = sel.toString();
  return { sel, range, pageDiv, pageNumber, rects, text };
}

viewerContainer.addEventListener('mouseup', () => {
  const info = currentSelectionInfo();
  if (!info) { markToolbar.classList.add('hidden'); return; }
  const last = info.rects[info.rects.length - 1];
  const containerRect = viewerContainer.getBoundingClientRect();
  markToolbar.style.left = (last.right - containerRect.left + viewerContainer.scrollLeft - 100) + 'px';
  markToolbar.style.top = (last.bottom - containerRect.top + viewerContainer.scrollTop + 6) + 'px';
  markToolbar.classList.remove('hidden');
  markToolbar._pending = info;
});

document.addEventListener('mousedown', (e) => {
  if (!markToolbar.contains(e.target)) markToolbar.classList.add('hidden');
});

markToolbar.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const info = markToolbar._pending;
    if (!info) return;
    createMark(info, btn.dataset.type);
    markToolbar.classList.add('hidden');
    window.getSelection().removeAllRanges();
  });
});

function createMark(info, type) {
  const pageView = pdfViewer.getPageView(info.pageNumber - 1);
  const pageRect = info.pageDiv.getBoundingClientRect();
  const pdfRects = info.rects.map((r) => {
    const x1 = r.left - pageRect.left;
    const y1 = r.top - pageRect.top;
    const x2 = r.right - pageRect.left;
    const y2 = r.bottom - pageRect.top;
    const [px1, py1, px2, py2] = pageView.viewport.convertToPdfPoint(x1, y1)
      .concat(pageView.viewport.convertToPdfPoint(x2, y2));
    return [Math.min(px1, px2), Math.min(py1, py2), Math.max(px1, px2), Math.max(py1, py2)];
  });
  const mark = { id: 'm' + Date.now() + Math.random().toString(36).slice(2, 7), type, rects: pdfRects, text: info.text };
  if (!highlightsByPage[info.pageNumber]) highlightsByPage[info.pageNumber] = [];
  highlightsByPage[info.pageNumber].push(mark);
  saveHighlights();
  renderMarksForPage(info.pageNumber);
}

function renderMarksForPage(pageNumber) {
  const pageView = pdfViewer.getPageView(pageNumber - 1);
  if (!pageView || !pageView.div) return;
  pageView.div.querySelectorAll('.text-mark').forEach((el) => el.remove());
  const marks = highlightsByPage[pageNumber] || [];
  marks.forEach((mark) => {
    mark.rects.forEach((rect) => {
      const [vx1, vy1, vx2, vy2] = pageView.viewport.convertToViewportRectangle(rect);
      const div = document.createElement('div');
      div.className = 'text-mark ' + mark.type;
      div.style.left = Math.min(vx1, vx2) + 'px';
      div.style.top = Math.min(vy1, vy2) + 'px';
      div.style.width = Math.abs(vx2 - vx1) + 'px';
      div.style.height = Math.abs(vy2 - vy1) + 'px';
      div.title = 'Kliknij, aby usunac';
      div.addEventListener('click', () => removeMark(pageNumber, mark.id));
      pageView.div.appendChild(div);
    });
  });
}

function removeMark(pageNumber, id) {
  highlightsByPage[pageNumber] = (highlightsByPage[pageNumber] || []).filter((m) => m.id !== id);
  saveHighlights();
  renderMarksForPage(pageNumber);
}

eventBus.on('pagerendered', (evt) => {
  renderMarksForPage(evt.pageNumber);
});

/* ---------- file opening plumbing ---------- */

function isPdfFile(file) {
  return (file.type && file.type === 'application/pdf') || file.name.toLowerCase().endsWith('.pdf');
}

function handleFile(file) {
  if (!file || !isPdfFile(file)) {
    setStatus('Wybierz plik w formacie PDF.');
    return;
  }
  const filePath = file.path || null;
  const reader = new FileReader();
  reader.onload = (e) => loadArrayBuffer(new Uint8Array(e.target.result), file.name, filePath);
  reader.onerror = () => setStatus('Nie udalo sie odczytac pliku.');
  reader.readAsArrayBuffer(file);
}

['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('drag-over'); })
);
dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(f);
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

window.electronAPI.onOpenPdf((payload) => {
  loadArrayBuffer(payload.data, payload.name, payload.path);
});

showDropzone();
const hasPendingFile = new URLSearchParams(location.search).get('pending') === '1';
if (!hasPendingFile) tryRestoreLastSession();
