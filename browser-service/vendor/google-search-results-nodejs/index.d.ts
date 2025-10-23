export interface GoogleSearchOptions {
  baseUrl?: string;
}

export type GoogleSearchCallback = (data: any) => void;
export type GoogleSearchErrorCallback = (error: Error) => void;

export declare class GoogleSearch {
  constructor(apiKey: string, options?: GoogleSearchOptions);
  execute(params?: Record<string, unknown>): Promise<any>;
  json(
    params: Record<string, unknown>,
    callback: GoogleSearchCallback,
    errorCallback?: GoogleSearchErrorCallback
  ): void;
}
