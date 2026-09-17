'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

// Maksymalny czas oczekiwania na pojedynczą konwersję LibreOffice, zanim uznamy
// proces za zawieszony (np. przez działający w tle Szybki Uruchamiacz LibreOffice
// blokujący profil użytkownika) i przerwiemy go z czytelnym komunikatem.
const CONVERT_TIMEOUT_MS = 120000;

// Miejsca, w których typowo instaluje się LibreOffice na poszczególnych systemach.
const CANDIDATES = {
  win32: [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
  ],
  darwin: [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  ],
  linux: [
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/snap/bin/libreoffice',
    '/opt/libreoffice/program/soffice'
  ]
};

let cachedPath = null;
let cacheChecked = false;

function existsSync(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function findSofficePath() {
  if (cacheChecked) return cachedPath;
  cacheChecked = true;

  const platformCandidates = CANDIDATES[process.platform] || [];
  for (const candidate of platformCandidates) {
    if (existsSync(candidate)) {
      cachedPath = candidate;
      return cachedPath;
    }
  }

  // Ostatnia próba: poleganie na PATH systemowym.
  const command = process.platform === 'win32' ? 'soffice.exe' : 'soffice';
  const found = await commandExistsOnPath(command);
  if (found) {
    cachedPath = command;
  }
  return cachedPath;
}

function commandExistsOnPath(command) {
  return new Promise((resolve) => {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    const child = spawn(checker, [command]);
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function isLibreOfficeAvailable() {
  const p = await findSofficePath();
  return Boolean(p);
}

/**
 * Konwertuje plik przy pomocy LibreOffice w trybie headless.
 * @param {string} inputPath ścieżka do pliku źródłowego
 * @param {string} outDir katalog docelowy
 * @param {'pdf'|'docx'} targetFormat format wyjściowy
 * @returns {Promise<string>} ścieżka do wygenerowanego pliku
 */
async function convertWithLibreOffice(inputPath, outDir, targetFormat) {
  const soffice = await findSofficePath();
  if (!soffice) {
    throw new Error(
      'Nie znaleziono programu LibreOffice. Zainstaluj go z libreoffice.org, aby konwertować pliki DOC/DOCX.'
    );
  }

  fs.mkdirSync(outDir, { recursive: true });

  // Każde wywołanie soffice dostaje własny profil użytkownika w katalogu tymczasowym,
  // dzięki czemu równoległe konwersje się nie blokują.
  const userProfileDir = path.join(
    os.tmpdir(),
    'pdfcon-lo-profile-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  );

  const args = [
    '--headless',
    '--norestore',
    '--nolockcheck',
    '--nodefault',
    // pathToFileURL koduje poprawnie ścieżki z literą dysku Windows (file:///C:/...);
    // ręczne sklejanie stringów tutaj dawało błędny URI i powodowało zawieszanie się
    // konwersji na Windows (LibreOffice czekał na zablokowany domyślny profil).
    '-env:UserInstallation=' + pathToFileURL(userProfileDir).href
  ];

  // Domyślnie LibreOffice otwiera PDF jako dokument Draw (obraz strony), z którego
  // nie da się wyeksportować do DOCX. Wymuszenie filtra "writer_pdf_import" każe
  // otworzyć PDF jako dokument Writer, dzięki czemu tekst pozostaje edytowalny.
  if (path.extname(inputPath).toLowerCase() === '.pdf' && targetFormat === 'docx') {
    args.push('--infilter=writer_pdf_import');
  }

  args.push('--convert-to', targetFormat, '--outdir', outDir, inputPath);

  await runProcess(soffice, args);

  const parsed = path.parse(inputPath);
  const expected = path.join(outDir, parsed.name + '.' + targetFormat);
  if (!existsSync(expected)) {
    throw new Error('Konwersja LibreOffice nie utworzyła oczekiwanego pliku: ' + expected);
  }
  return expected;
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      reject(
        new Error(
          'LibreOffice nie odpowiedział w ciągu 2 minut i konwersja została przerwana. ' +
            'Zamknij wszystkie otwarte okna LibreOffice oraz jego "Szybki Uruchamiacz" ' +
            '(ikona w zasobniku systemowym obok zegara) i spróbuj ponownie.'
        )
      );
    }, CONVERT_TIMEOUT_MS);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('LibreOffice zakończył pracę z kodem ' + code + (stderr ? ': ' + stderr : '')));
      }
    });
  });
}

module.exports = {
  isLibreOfficeAvailable,
  convertWithLibreOffice
};
