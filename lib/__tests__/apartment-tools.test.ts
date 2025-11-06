import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApartmentService } from '../apartment-tools';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApartmentService', () => {
  let apartmentService: ReturnType<typeof getApartmentService>;

  beforeEach(() => {
    vi.clearAllMocks();
    apartmentService = getApartmentService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchListings', () => {
    it('should handle listing search success', async () => {
      const mockListings = [
        {
          id: 'test-1',
          title: '2BR Apartment - Downtown',
          company: 'Property Management Inc',
          location: 'San Francisco, CA',
          salary: '$2,500/mo',
          url: 'https://zillow.com/listing/123',
          description: '2 bedroom apartment with modern amenities',
          application_url: 'https://zillow.com/listing/123',
          source: 'manual' as const,
          skills: [],
          experience_level: 'unknown',
          job_type: 'full-time',
          remote_type: 'unknown',
          applied: false,
          status: 'discovered' as const,
          created_at: new Date().toISOString()
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockListings
        })
      });

      const results = await apartmentService.searchListings({
        location: 'San Francisco',
        bedrooms: 2
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('2BR Apartment - Downtown');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search-listings'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key-12345'
          }),
          body: JSON.stringify({
            location: 'San Francisco',
            bedrooms: 2
          })
        })
      );
    });

    it('should handle listing search API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ 
          success: false,
          error: 'Internal server error' 
        })
      });

      await expect(
        apartmentService.searchListings({
          location: 'San Francisco'
        })
      ).rejects.toThrow('Internal server error');
    });

    it('should handle service returning failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'No listings found'
        })
      });

      await expect(
        apartmentService.searchListings({
          location: 'San Francisco'
        })
      ).rejects.toThrow('No listings found');
    });
  });

  describe('getListingDetails', () => {
    it('should handle getting listing details success', async () => {
      const mockDetails = {
        title: '2BR Apartment - Downtown',
        price: '$2,500/mo',
        beds: 2,
        baths: 1,
        amenities: ['parking', 'laundry']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockDetails
        })
      });

      const result = await apartmentService.getListingDetails({
        listingUrl: 'https://zillow.com/listing/123'
      });

      expect(result).toEqual(mockDetails);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/get-listing-details'),
        expect.objectContaining({
          body: JSON.stringify({
            listingUrl: 'https://zillow.com/listing/123'
          })
        })
      );
    });
  });

  describe('extractContact', () => {
    it('should handle extracting contact info success', async () => {
      const mockContact = {
        contactName: 'John Doe',
        phone: '555-1234',
        email: 'contact@example.com',
        applicationUrl: 'https://example.com/apply'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockContact
        })
      });

      const result = await apartmentService.extractContact({
        listingUrl: 'https://zillow.com/listing/123'
      });

      expect(result).toEqual(mockContact);
    });
  });

  describe('scheduleVisit', () => {
    it('should handle scheduling visit success', async () => {
      const mockResponse = {
        success: true,
        message: 'Visit scheduled'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockResponse
        })
      });

      const result = await apartmentService.scheduleVisit({
        listingUrl: 'https://zillow.com/listing/123',
        sessionId: 'session-123',
        userProfile: { name: 'Test User' },
        preferredTimes: ['2024-01-15 10:00 AM']
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('saveFavorite', () => {
    it('should handle saving favorite success', async () => {
      const mockResponse = {
        success: true,
        favoriteId: 'fav-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockResponse
        })
      });

      const result = await apartmentService.saveFavorite({
        userId: 'user-123',
        listing: { id: 'listing-123' }
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(
        apartmentService.searchListings({
          location: 'test'
        })
      ).rejects.toThrow('Invalid JSON');
    });

    it('should handle network connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(
        apartmentService.searchListings({
          location: 'test'
        })
      ).rejects.toThrow('Network connection failed');
    });
  });

  describe('parameter validation', () => {
    it('should pass all parameters correctly to search listings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      await apartmentService.searchListings({
        location: 'San Francisco',
        keywords: 'pet-friendly',
        min_price: 2000,
        max_price: 3000,
        bedrooms: 2,
        bathrooms: 2,
        pets: 'yes',
        page: 1
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search-listings'),
        expect.objectContaining({
          body: JSON.stringify({
            location: 'San Francisco',
            keywords: 'pet-friendly',
            min_price: 2000,
            max_price: 3000,
            bedrooms: 2,
            bathrooms: 2,
            pets: 'yes',
            page: 1
          })
        })
      );
    });
  });
});
