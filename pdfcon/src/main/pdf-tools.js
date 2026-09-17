'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

/**
 * Łączy wiele plików PDF w jeden, w podanej kolejności.
 * @param {string[]} inputPaths
 * @param {string} outputPath
 */
async function mergePdfs(inputPaths, outputPath) {
  const merged = await PDFDocument.create();
  for (const inputPath of inputPaths) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const copiedPages = await merged.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => merged.addPage(page));
  }
  const outBytes = await merged.save();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outBytes);
  return outputPath;
}

/**
 * Parsuje zakres stron w formacie "1-3,5,7-9" na listę indeksów (0-based).
 * @param {string} rangeText
 * @param {number} pageCount
 * @returns {number[]}
 */
function parsePageRange(rangeText, pageCount) {
  const indices = new Set();
  const parts = rangeText.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      for (let i = start; i <= end; i += 1) {
        if (i >= 1 && i <= pageCount) indices.add(i - 1);
      }
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= pageCount) indices.add(n - 1);
    } else {
      throw new Error('Nieprawidłowy format zakresu stron: "' + part + '"');
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Dzieli PDF na osobne pliki - albo każdą stronę osobno, albo wg zakresu.
 * @param {string} inputPath
 * @param {string} outDir
 * @param {{mode: 'all'|'range', range?: string}} options
 * @returns {Promise<string[]>} lista utworzonych plików
 */
async function splitPdf(inputPath, outDir, options) {
  const bytes = fs.readFileSync(inputPath);
  const srcDoc = await PDFDocument.load(bytes);
  const pageCount = srcDoc.getPageCount();
  const baseName = path.parse(inputPath).name;

  fs.mkdirSync(outDir, { recursive: true });
  const created = [];

  if (options.mode === 'all') {
    for (let i = 0; i < pageCount; i += 1) {
      const outDoc = await PDFDocument.create();
      const [page] = await outDoc.copyPages(srcDoc, [i]);
      outDoc.addPage(page);
      const outBytes = await outDoc.save();
      const outPath = uniquePath(path.join(outDir, `${baseName}_strona_${i + 1}.pdf`));
      fs.writeFileSync(outPath, outBytes);
      created.push(outPath);
    }
  } else if (options.mode === 'range') {
    const indices = parsePageRange(options.range || '', pageCount);
    if (indices.length === 0) {
      throw new Error('Podany zakres stron nie wskazuje żadnej istniejącej strony.');
    }
    const outDoc = await PDFDocument.create();
    const pages = await outDoc.copyPages(srcDoc, indices);
    pages.forEach((page) => outDoc.addPage(page));
    const outBytes = await outDoc.save();
    const outPath = uniquePath(path.join(outDir, `${baseName}_zakres.pdf`));
    fs.writeFileSync(outPath, outBytes);
    created.push(outPath);
  } else {
    throw new Error('Nieznany tryb dzielenia PDF: ' + options.mode);
  }

  return created;
}

/**
 * Tworzy PDF z jednego lub wielu obrazów (JPG/PNG).
 * @param {string[]} imagePaths
 * @param {string} outputPath
 * @param {boolean} combineIntoOne jeśli true - jeden PDF wielostronicowy, jeśli false - osobne PDF-y (obsługiwane przez wywołującego)
 */
async function imagesToPdf(imagePaths, outputPath) {
  const doc = await PDFDocument.create();
  for (const imagePath of imagePaths) {
    const ext = path.extname(imagePath).toLowerCase();
    // Uint8Array.from() kopiuje dane do świeżego ArrayBuffer (byteOffset 0).
    // Bez tego pdf-lib błędnie odczytuje nagłówek JPEG/PNG dla małych plików,
    // których bufor Node.js pochodzi ze współdzielonej puli pamięci.
    const bytes = Uint8Array.from(fs.readFileSync(imagePath));
    let image;
    if (ext === '.png') {
      image = await doc.embedPng(bytes);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      image = await doc.embedJpg(bytes);
    } else {
      throw new Error('Nieobsługiwany format obrazu: ' + ext);
    }
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const outBytes = await doc.save();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outBytes);
  return outputPath;
}

async function getPdfPageCount(inputPath) {
  const bytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

function uniquePath(candidatePath) {
  if (!fs.existsSync(candidatePath)) return candidatePath;
  const { dir, name, ext } = path.parse(candidatePath);
  let counter = 2;
  let next = path.join(dir, `${name} (${counter})${ext}`);
  while (fs.existsSync(next)) {
    counter += 1;
    next = path.join(dir, `${name} (${counter})${ext}`);
  }
  return next;
}

module.exports = {
  mergePdfs,
  splitPdf,
  imagesToPdf,
  getPdfPageCount,
  parsePageRange,
  uniquePath
};
