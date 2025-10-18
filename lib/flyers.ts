// lib/flyers.ts
// Purpose: Utilities for retrieving flyer metrics from Supabase for marketing experiences.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service-client';

/**
 * Fetches the total number of flyers that have been created.
 *
 * @returns The exact count of flyers if available, otherwise null when metrics cannot be retrieved.
 */
export async function getFlyerCount(): Promise<number | null> {
  let supabase: SupabaseClient | null = null;

  try {
    supabase = getSupabaseServiceRoleClient();
  } catch (error) {
    console.warn('Unable to create Supabase service client for flyer metrics:', error);
    return null;
  }

  try {
    const { count, error } = await supabase
      .from('flyers')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching flyer count from Supabase:', error);
      return null;
    }

    return typeof count === 'number' ? count : null;
  } catch (error) {
    console.error('Unexpected error while fetching flyer count:', error);
    return null;
  }
}
