'use strict';

/* global pdfjsLib */

pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.min.js';

const FILTERS = {
  '.doc,.docx,.jpg,.jpeg,.png': [
    { name: 'Dokumenty i obrazy', extensions: ['doc', 'docx', 'jpg', 'jpeg', 'png'] }
  ],
  '.pdf': [{ name: 'Pliki PDF', extensions: ['pdf'] }]
};

function extOf(filePath) {
  const m = /\.[^./\\]+$/.exec(filePath);
  return m ? m[0].toLowerCase() : '';
}

function baseNameOf(filePath) {
  return filePath.split(/[\\/]/).pop();
}

function fileBadge(ext) {
  if (ext === '.pdf') return { label: 'PDF', cls: 'file-badge--pdf' };
  if (ext === '.doc' || ext === '.docx') return { label: ext === '.doc' ? 'DOC' : 'DOCX', cls: 'file-badge--doc' };
  if (ext === '.jpg' || ext === '.jpeg') return { label: 'JPG', cls: 'file-badge--img' };
  if (ext === '.png') return { label: 'PNG', cls: 'file-badge--img' };
  return { label: ext.replace('.', '').toUpperCase() || '?', cls: 'file-badge--doc' };
}

function icon(name) {
  return `<svg class="icon"><use href="#icon-${name}"/></svg>`;
}

// ---------------------------------------------------------------------------
// Kontroler pojedynczego widoku (zakładki)
// ---------------------------------------------------------------------------

class ViewController {
  constructor(section) {
    this.section = section;
    this.acceptList = (section.dataset.accept || '').split(',').filter(Boolean);
    this.singleFile = section.hasAttribute('data-single');
    this.reorderable = section.hasAttribute('data-reorderable');

    this.dropzone = section.querySelector('[data-dropzone]');
    this.pickBtn = section.querySelector('[data-pick]');
    this.listEl = section.querySelector('[data-file-list]');
    this.actionBtn = section.querySelector('[data-action]');
    this.resultsEl = section.querySelector('[data-results]');

    this.files = []; // { path, name, ext }

    this.pickBtn.addEventListener('click', () => this.handlePick());

    ['dragenter', 'dragover'].forEach((evt) =>
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropzone.classList.add('drag-over');
      })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('drag-over');
      })
    );
    this.dropzone.addEventListener('drop', (e) => this.handleDrop(e));

    this.onConvert = null; // ustawiane z zewnątrz
    this.onFilesChanged = null; // ustawiane z zewnątrz (opcjonalny hook)

    this.actionBtn.addEventListener('click', () => {
      if (this.onConvert) this.onConvert(this.files.map((f) => f.path));
    });
  }

  isAccepted(filePath) {
    if (this.acceptList.length === 0) return true;
    return this.acceptList.includes(extOf(filePath));
  }

  addFiles(paths) {
    const accepted = paths.filter((p) => this.isAccepted(p));
    const rejectedCount = paths.length - accepted.length;

    if (this.singleFile) {
      this.files = accepted.slice(-1).map((p) => ({ path: p, name: baseNameOf(p), ext: extOf(p) }));
    } else {
      const existing = new Set(this.files.map((f) => f.path));
      for (const p of accepted) {
        if (!existing.has(p)) {
          this.files.push({ path: p, name: baseNameOf(p), ext: extOf(p) });
          existing.add(p);
        }
      }
    }

    if (rejectedCount > 0) {
      this.showBanner(
        'error',
        `Pominięto ${rejectedCount} plik(ów) o nieobsługiwanym formacie dla tej funkcji.`
      );
    }

    this.render();
    if (this.onFilesChanged) this.onFilesChanged(this.files);
  }

  removeFile(path) {
    this.files = this.files.filter((f) => f.path !== path);
    this.render();
    if (this.onFilesChanged) this.onFilesChanged(this.files);
  }

  moveFile(path, direction) {
    const idx = this.files.findIndex((f) => f.path === path);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= this.files.length) return;
    const [item] = this.files.splice(idx, 1);
    this.files.splice(target, 0, item);
    this.render();
    if (this.onFilesChanged) this.onFilesChanged(this.files);
  }

  clearFiles() {
    this.files = [];
    this.render();
    if (this.onFilesChanged) this.onFilesChanged(this.files);
  }

  async handlePick() {
    const key = this.acceptList.join(',');
    const filters = FILTERS[key] || undefined;
    const paths = await window.pdfcon.pickFiles(filters);
    if (paths && paths.length) this.addFiles(paths);
  }

  handleDrop(e) {
    const dropped = Array.from(e.dataTransfer.files)
      .map((f) => f.path)
      .filter(Boolean);
    if (dropped.length) this.addFiles(dropped);
  }

  render() {
    this.listEl.innerHTML = '';
    this.files.forEach((file, idx) => {
      const badge = fileBadge(file.ext);
      const li = document.createElement('li');
      li.className = 'file-row';

      const reorderHtml = this.reorderable
        ? `<button class="icon-btn" data-move="-1" ${idx === 0 ? 'disabled' : ''} title="Przesuń wyżej">▲</button>
           <button class="icon-btn" data-move="1" ${idx === this.files.length - 1 ? 'disabled' : ''} title="Przesuń niżej">▼</button>`
        : '';

      li.innerHTML = `
        <div class="file-badge ${badge.cls}">${badge.label}</div>
        <div class="file-meta">
          <div class="file-name" title="${file.path}">${file.name}</div>
          <div class="file-sub">${this.reorderable ? `Pozycja ${idx + 1}` : file.ext.replace('.', '').toUpperCase()}</div>
        </div>
        <div class="file-row-actions">
          ${reorderHtml}
          <button class="icon-btn danger" data-remove title="Usuń">${icon('trash')}</button>
        </div>
      `;

      if (this.reorderable) {
        li.querySelectorAll('[data-move]').forEach((btn) => {
          btn.addEventListener('click', () => this.moveFile(file.path, parseInt(btn.dataset.move, 10)));
        });
      }
      li.querySelector('[data-remove]').addEventListener('click', () => this.removeFile(file.path));

      this.listEl.appendChild(li);
    });
  }

  showBanner(type, message) {
    const banner = document.createElement('div');
    banner.className = `result-banner ${type}`;
    banner.innerHTML = `${icon(type === 'success' ? 'check' : 'warn')}<span>${message}</span>`;
    this.resultsEl.prepend(banner);
  }

  showResults(created, errors, outputDir) {
    this.resultsEl.innerHTML = '';
    if (created.length > 0) {
      this.showBanner(
        'success',
        `Gotowe! Utworzono ${created.length} plik(ów) w folderze ${outputDir || 'Pobrane/PDFcon'}.`
      );
      created.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'result-item';
        row.innerHTML = `
          <span class="path" title="${p}">${baseNameOf(p)}</span>
          <button class="icon-btn" title="Otwórz plik">${icon('folder')}</button>
        `;
        row.querySelector('button').addEventListener('click', () => window.pdfcon.openPath(p));
        this.resultsEl.appendChild(row);
      });
    }
    if (errors && errors.length > 0) {
      errors.forEach((e) => this.showBanner('error', `${baseNameOf(e.file || '')}: ${e.message}`));
    }
  }

  setBusy(isBusy, label) {
    const span = this.actionBtn.querySelector('span');
    const iconEl = this.actionBtn.querySelector('.icon');
    if (isBusy) {
      this._originalLabel = span.textContent;
      this._originalIconHtml = iconEl.outerHTML;
      this.actionBtn.disabled = true;
      iconEl.outerHTML = `<svg class="icon spin"><use href="#icon-loader"/></svg>`;
      span.textContent = label || 'Przetwarzanie…';
    } else {
      span.textContent = this._originalLabel || span.textContent;
      if (this._originalIconHtml) {
        this.actionBtn.querySelector('.icon').outerHTML = this._originalIconHtml;
      }
      this.updateActionState();
    }
  }

  updateActionState() {
    const minFiles = this.reorderable ? 2 : 1;
    this.actionBtn.disabled = this.files.length < minFiles;
  }
}

// ---------------------------------------------------------------------------
// Nawigacja między widokami
// ---------------------------------------------------------------------------

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  });
});

document.getElementById('open-output-btn').addEventListener('click', async () => {
  const dir = await window.pdfcon.getOutputDir();
  window.pdfcon.openPath(dir);
});

// ---------------------------------------------------------------------------
// Status LibreOffice
// ---------------------------------------------------------------------------

(async () => {
  const statusEl = document.getElementById('lo-status');
  const available = await window.pdfcon.checkLibreOffice();
  if (available) {
    statusEl.textContent = 'LibreOffice: dostępny ✓ (konwersje DOC/DOCX aktywne)';
    statusEl.classList.add('ok');
  } else {
    statusEl.textContent = 'LibreOffice nie znaleziony — konwersje DOC/DOCX są niedostępne. Zainstaluj z libreoffice.org.';
    statusEl.classList.add('missing');
  }
})();

// ---------------------------------------------------------------------------
// Widok: Konwertuj na PDF
// ---------------------------------------------------------------------------

{
  const section = document.getElementById('view-to-pdf');
  const ctrl = new ViewController(section);
  const imagesOptions = section.querySelector('[data-options-images]');
  const combineCheckbox = document.getElementById('combine-images');

  ctrl.onFilesChanged = (files) => {
    const hasImages = files.some((f) => f.ext === '.jpg' || f.ext === '.jpeg' || f.ext === '.png');
    imagesOptions.hidden = !hasImages;
    ctrl.updateActionState();
  };

  ctrl.onConvert = async (paths) => {
    ctrl.setBusy(true, 'Konwertowanie…');
    try {
      const result = await window.pdfcon.convertToPdf(paths, { combineImages: combineCheckbox.checked });
      ctrl.showResults(result.created, result.errors, result.outputDir);
      ctrl.clearFiles();
    } catch (err) {
      ctrl.showBanner('error', err.message);
    } finally {
      ctrl.setBusy(false);
    }
  };
}

// ---------------------------------------------------------------------------
// Widok: Konwertuj z PDF
// ---------------------------------------------------------------------------

{
  const section = document.getElementById('view-from-pdf');
  const ctrl = new ViewController(section);
  const segmented = section.querySelector('[data-target-format]');
  const progressWrap = section.querySelector('[data-progress]');
  const progressFill = section.querySelector('[data-progress-fill]');
  const progressText = section.querySelector('[data-progress-text]');

  let targetFormat = 'docx';
  segmented.querySelectorAll('.segmented-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      segmented.querySelectorAll('.segmented-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      targetFormat = btn.dataset.format;
    });
  });

  ctrl.onFilesChanged = () => ctrl.updateActionState();

  function setProgress(current, total, label) {
    if (total <= 0) {
      progressWrap.hidden = true;
      return;
    }
    progressWrap.hidden = false;
    progressFill.style.width = Math.round((current / total) * 100) + '%';
    progressText.textContent = label;
  }

  ctrl.onConvert = async (paths) => {
    ctrl.setBusy(true, 'Konwertowanie…');
    const created = [];
    const errors = [];

    try {
      if (targetFormat === 'docx') {
        const result = await window.pdfcon.convertPdfToOffice(paths);
        created.push(...result.created);
        errors.push(...result.errors);
      } else {
        let done = 0;
        for (const filePath of paths) {
          try {
            const loadingTask = pdfjsLib.getDocument({ url: toFileUrl(filePath) });
            const pdf = await loadingTask.promise;
            const baseName = baseNameOf(filePath).replace(/\.pdf$/i, '');

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
              setProgress(done, paths.length * pdf.numPages, `Strona ${pageNum}/${pdf.numPages} — ${baseName}`);
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 2 });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d');
              await page.render({ canvasContext: ctx, viewport }).promise;

              const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
              const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));
              const arrayBuffer = await blob.arrayBuffer();
              const savedPath = await window.pdfcon.saveImageBuffer(baseName, pageNum, targetFormat, arrayBuffer);
              created.push(savedPath);
              done += 1;
            }
          } catch (err) {
            errors.push({ file: filePath, message: err.message });
          }
        }
      }

      const outputDir = await window.pdfcon.getOutputDir();
      ctrl.showResults(created, errors, outputDir);
      ctrl.clearFiles();
    } catch (err) {
      ctrl.showBanner('error', err.message);
    } finally {
      setProgress(0, 0, '');
      ctrl.setBusy(false);
    }
  };
}

function toFileUrl(filePath) {
  let p = filePath.replace(/\\/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  return 'file://' + encodeURI(p).replace(/#/g, '%23');
}

// ---------------------------------------------------------------------------
// Widok: Scal PDF
// ---------------------------------------------------------------------------

{
  const section = document.getElementById('view-merge');
  const ctrl = new ViewController(section);
  ctrl.onFilesChanged = () => ctrl.updateActionState();

  ctrl.onConvert = async (paths) => {
    if (paths.length < 2) {
      ctrl.showBanner('error', 'Dodaj co najmniej dwa pliki PDF, aby je scalić.');
      return;
    }
    ctrl.setBusy(true, 'Scalanie…');
    try {
      const result = await window.pdfcon.mergePdfs(paths);
      ctrl.showResults(result.created, result.errors, result.outputDir);
      ctrl.clearFiles();
    } catch (err) {
      ctrl.showBanner('error', err.message);
    } finally {
      ctrl.setBusy(false);
    }
  };
}

// ---------------------------------------------------------------------------
// Widok: Podziel PDF
// ---------------------------------------------------------------------------

{
  const section = document.getElementById('view-split');
  const ctrl = new ViewController(section);
  const optionsWrap = section.querySelector('[data-split-options]');
  const rangeInput = section.querySelector('[data-range-input]');
  const pageCountHint = section.querySelector('[data-page-count-hint]');
  const modeRadios = section.querySelectorAll('input[name="split-mode"]');

  modeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      rangeInput.disabled = radio.value !== 'range' || !radio.checked;
      section.querySelectorAll('input[name="split-mode"]').forEach((r) => {
        if (r.checked) rangeInput.disabled = r.value !== 'range';
      });
    });
  });

  ctrl.onFilesChanged = async (files) => {
    optionsWrap.hidden = files.length === 0;
    ctrl.updateActionState();
    if (files.length === 1) {
      try {
        const count = await window.pdfcon.getPdfPageCount(files[0].path);
        pageCountHint.textContent = `Liczba stron w dokumencie: ${count}.`;
      } catch {
        pageCountHint.textContent = '';
      }
    } else {
      pageCountHint.textContent = '';
    }
  };

  ctrl.onConvert = async (paths) => {
    if (paths.length !== 1) {
      ctrl.showBanner('error', 'Wybierz dokładnie jeden plik PDF do podziału.');
      return;
    }
    const mode = section.querySelector('input[name="split-mode"]:checked').value;
    const range = rangeInput.value.trim();
    if (mode === 'range' && !range) {
      ctrl.showBanner('error', 'Podaj zakres stron, np. 1-3,5,7-9.');
      return;
    }

    ctrl.setBusy(true, 'Dzielenie…');
    try {
      const result = await window.pdfcon.splitPdf(paths[0], { mode, range });
      ctrl.showResults(result.created, result.errors, result.outputDir);
      ctrl.clearFiles();
    } catch (err) {
      ctrl.showBanner('error', err.message);
    } finally {
      ctrl.setBusy(false);
    }
  };
}
