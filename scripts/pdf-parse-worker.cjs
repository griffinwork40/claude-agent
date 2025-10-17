#!/usr/bin/env node
/**
 * Helper script executed in a separate Node process to parse PDFs with pdf-parse.
 * Reading and parsing happens outside the Next.js webpack bundle to avoid
 * compatibility issues when pdf-parse pulls in pdfjs-dist.
 */

const { PDFParse } = require('pdf-parse');

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

    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText(options);
      const infoResult = await parser.getInfo();

      const payload = {
        text: textResult.text,
        numpages: infoResult?.total ?? undefined,
        info: infoResult?.info ?? undefined,
        version: infoResult?.info?.PDFFormatVersion ?? undefined,
      };

      process.stdout.write(JSON.stringify(payload));
    } finally {
      try {
        await parser.destroy();
      } catch (destroyError) {
        // ignore cleanup errors
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(message);
    process.exit(1);
  }
})();
