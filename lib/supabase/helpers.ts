import { PostgrestSingleResponse } from '@supabase/supabase-js';

/**
 * Type-safe wrapper for Supabase .single() queries.
 *
 * The .single() method can fail silently - it returns an error when:
 * - No rows found (PGRST116)
 * - Multiple rows found (unexpected)
 *
 * This helper ensures you always check for errors before accessing data.
 *
 * @example
 * const result = await safeSingle(
 *   supabase.from('tribes').select('id').eq('slug', slug).single()
 * );
 *
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: result.status });
 * }
 *
 * // TypeScript now knows result.data is defined
 * const tribe = result.data;
 */
export type SafeSingleResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: 404 | 500 };

export async function safeSingle<T>(
  query: PromiseLike<PostgrestSingleResponse<T>>
): Promise<SafeSingleResult<T>> {
  const { data, error } = await query;

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    const isNotFound = error.code === 'PGRST116' || error.message.includes('0 rows');
    return {
      success: false,
      error: isNotFound ? 'Not found' : error.message,
      status: isNotFound ? 404 : 500,
    };
  }

  if (!data) {
    return {
      success: false,
      error: 'Not found',
      status: 404,
    };
  }

  return { success: true, data };
}

/**
 * Simplified version that returns null on any error.
 * Use when you just need the data and will handle null yourself.
 *
 * @example
 * const tribe = await singleOrNull(
 *   supabase.from('tribes').select('id').eq('slug', slug).single()
 * );
 * if (!tribe) return NextResponse.json({ error: 'Not found' }, { status: 404 });
 */
export async function singleOrNull<T>(
  query: PromiseLike<PostgrestSingleResponse<T>>
): Promise<T | null> {
  const { data, error } = await query;
  if (error || !data) return null;
  return data;
}
