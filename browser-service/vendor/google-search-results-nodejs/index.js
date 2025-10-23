const DEFAULT_BASE_URL = 'https://serpapi.com/search.json';

class GoogleSearch {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('SerpApi API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  }

  async execute(params = {}) {
    const query = new URLSearchParams({ api_key: this.apiKey });

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(item => query.append(key, String(item)));
      } else if (typeof value === 'object') {
        query.append(key, JSON.stringify(value));
      } else {
        query.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}?${query.toString()}`);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`SerpApi request failed with status ${response.status}: ${text || response.statusText}`);
    }

    return response.json();
  }

  json(params, callback, errorCallback) {
    this.execute(params)
      .then(result => {
        if (typeof callback === 'function') {
          callback(result);
        }
      })
      .catch(error => {
        if (typeof errorCallback === 'function') {
          errorCallback(error);
          return;
        }

        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      });
  }
}

module.exports = {
  GoogleSearch
};
