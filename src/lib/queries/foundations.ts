import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type FoundationRow = Database['public']['Tables']['foundations']['Row'];

/** Foundations a store may pick as a donation recipient. */
export async function getActiveFoundations(): Promise<Pick<FoundationRow, 'id' | 'name'>[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('foundations')
    .select('id, name')
    .eq('active', true)
    .order('name');

  return data ?? [];
}

/** Every foundation, active first (admin management page). */
export async function getAllFoundations(): Promise<FoundationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('foundations')
    .select('*')
    .order('active', { ascending: false })
    .order('name');

  return data ?? [];
}
