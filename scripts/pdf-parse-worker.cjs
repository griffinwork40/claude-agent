#!/usr/bin/env node
/**
 * Helper script executed in a separate Node process to parse PDFs with pdf-parse.
 * Reading and parsing happens outside the Next.js webpack bundle to avoid
 * compatibility issues when pdf-parse pulls in pdfjs-dist.
 */

const pdfParse = require('pdf-parse');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

(async () => {
  try {
    const buffer = await readStdin();
    if (!buffer || buffer.length === 0) {
      throw new Error('No PDF data received on stdin');
    }

    const options = {
      first: 50,
    };

    const result = await pdfParse(buffer, options);

    const payload = {
      text: result.text,
      numpages: result.numpages ?? result.info?.numpages ?? undefined,
      info: result.info ?? undefined,
      version: result.info?.PDFFormatVersion ?? result.metadata?._metadata?.get('pdf:PDFVersion') ?? undefined,
    };

    process.stdout.write(JSON.stringify(payload));
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(message);
    process.exit(1);
  }
})();
