import fs from 'fs';
import * as pdfjs from 'pdfjs-dist';

const pdfPath = process.argv[2];
if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error(JSON.stringify({ error: 'File not found', pages: [] }));
  process.exit(1);
}

async function extract() {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true
    });
    const doc = await loadingTask.promise;
    const pages = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(pageText);
    }

    console.log(JSON.stringify({ success: true, pageCount: doc.numPages, pages }));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message, pages: [] }));
    process.exit(1);
  }
}

extract();
