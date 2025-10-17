declare module 'google-search-results-nodejs' {
  export class SerpApi {
    constructor(apiKey: string);
    json(params: any): Promise<any>;
  }
}
