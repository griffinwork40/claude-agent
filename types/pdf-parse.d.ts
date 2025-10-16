declare module 'pdf-parse' {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    text: string;
    version: string;
  }

  type PDFParseOptions = Record<string, unknown>;

  function pdfParse(data: Buffer | Uint8Array, options?: PDFParseOptions): Promise<PDFParseResult>;

  export type { PDFParseOptions, PDFParseResult };
  export default pdfParse;
}
