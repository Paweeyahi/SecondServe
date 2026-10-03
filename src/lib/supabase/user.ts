import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './server';

/**
 * `supabase.auth.getUser()` round-trips to the Supabase Auth server to
 * verify the JWT -- correct, but slow if called more than once per request.
 * Every query/action in this app that needs "the current user" used to call
 * it independently, so a single page render could fire the same auth
 * check 2-3 times. `React.cache()` memoizes this per request (the same
 * mechanism Next.js uses for `fetch()` dedup), so every caller within one
 * render/action shares a single verified result.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
