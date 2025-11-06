// lib/apartment-tools.ts
// Apartment-search tool definitions and HTTP client for the browser automation service
import { JobOpportunity } from '@/types'; // reuse existing types where possible

class ApartmentService {
  private serviceUrl = process.env.BROWSER_SERVICE_URL || 'http://localhost:3001';
  private apiKey = process.env.BROWSER_SERVICE_API_KEY || 'test-key-12345';

  private async request(endpoint: string, body: Record<string, unknown>) {
    const url = `${this.serviceUrl}${endpoint}`;
    console.log(`🌐 Apartment service request: ${endpoint}`, { body });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText, status: response.status }));
        console.error(`❌ Apartment service error (${response.status}):`, err);
        throw new Error(err.error || response.statusText);
      }

      const result = await response.json();
      if (!result.success) {
        console.error('❌ Apartment service returned failure:', result);
        throw new Error(result.error || 'Request failed');
      }

      return result.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Apartment service request failed:', { endpoint, error: msg });
      throw error;
    }
  }

  // Search aggregated listings (Zillow / Apartments.com / Craigslist fallback)
  async searchListings(params: {
    keywords?: string;
    location: string;
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
    bathrooms?: number;
    pets?: 'yes' | 'no' | 'negotiable';
    page?: number;
  }): Promise<JobOpportunity[]> {
    return this.request('/api/search-listings', params) as Promise<JobOpportunity[]>;
  }

  // Get full listing details (HTML, snapshot, structured fields)
  async getListingDetails(params: { listingUrl: string; sessionId?: string }): Promise<any> {
    return this.request('/api/get-listing-details', params);
  }

  // Extract contact or application URL from a listing
  async extractContact(params: { listingUrl: string }): Promise<{ contactName?: string; phone?: string | null; email?: string | null; applicationUrl?: string | null }> {
    return this.request('/api/extract-contact', params);
  }

  // Schedule a visit (attempts to open contact form / send message / prefill calendar invite)
  async scheduleVisit(params: { listingUrl: string; sessionId: string; userProfile: Record<string, unknown>; preferredTimes: string[] }) {
    return this.request('/api/schedule-visit', params);
  }

  // Save favorite listing (persist to backend)
  async saveFavorite(params: { userId: string; listing: Record<string, unknown> }) {
    return this.request('/api/save-favorite', params);
  }
}

let apartmentService: ApartmentService | null = null;
export const getApartmentService = (): ApartmentService => {
  if (!apartmentService) apartmentService = new ApartmentService();
  return apartmentService;
};

// Tool metadata for Claude (the stream handler expects these tool definitions)
export const apartmentTools = [
  {
    name: 'search_listings',
    description: 'Search rental listings on major aggregator and board sites using keywords and filters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        location: { type: 'string', description: 'City, neighborhood or zip code' },
        keywords: { type: 'string', description: 'Optional keywords (e.g., "no-fee, in-unit laundry")' },
        min_price: { type: 'number' },
        max_price: { type: 'number' },
        bedrooms: { type: 'number' },
        page: { type: 'number' }
      },
      required: ['location']
    }
  },
  {
    name: 'get_listing_details',
    description: 'Fetch the listing page, snapshot it, and extract structured data (price, beds, baths, amenities, contact/apply URL).',
    input_schema: {
      type: 'object' as const,
      properties: {
        listingUrl: { type: 'string' }
      },
      required: ['listingUrl']
    }
  },
  {
    name: 'extract_contact',
    description: 'Extract contact info or direct application URL from a listing page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        listingUrl: { type: 'string' }
      },
      required: ['listingUrl']
    }
  },
  {
    name: 'schedule_visit',
    description: 'Attempt to schedule a visit or send a message to the lister using a saved user profile and preferred times.',
    input_schema: {
      type: 'object' as const,
      properties: {
        listingUrl: { type: 'string' },
        sessionId: { type: 'string' },
        userProfile: { type: 'object' },
        preferredTimes: { type: 'array', items: { type: 'string' } }
      },
      required: ['listingUrl', 'sessionId', 'userProfile', 'preferredTimes']
    }
  },
  {
    name: 'save_favorite_listing',
    description: 'Save a listing to user favorites for later review.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        listing: { type: 'object' }
      },
      required: ['userId', 'listing']
    }
  }
];
