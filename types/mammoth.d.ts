declare module 'mammoth' {
  interface MammothMessage {
    type: string;
    message: string;
  }

  interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  interface ExtractRawTextOptions {
    path: string;
  }

  function extractRawText(options: ExtractRawTextOptions): Promise<MammothResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
  };

  export type { ExtractRawTextOptions, MammothMessage, MammothResult };
  export { extractRawText };
  export default mammoth;
}
