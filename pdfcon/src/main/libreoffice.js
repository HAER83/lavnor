'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Miejsca, w których typowo instaluje się LibreOffice na poszczególnych systemach.
const CANDIDATES = {
  win32: [
    'C\\Program Files\\LibreOffice\\program\\soffice.exe',
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
    '-env:UserInstallation=file://' + userProfileDir.replace(/\\/g, '/')
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
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
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
