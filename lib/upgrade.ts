import { after } from 'next/server';
import { ensureSchema } from './migrate';

/**
 * Starts the one-time database update (if one is due) WITHOUT making the page
 * wait, and keeps the server running until it finishes.
 *
 * Why: Vercel pauses a server as soon as a page has been sent. The update used
 * to run "in the background" of a page, so it was paused halfway, timed out on
 * the next visit ("took longer than 20 seconds"), and never finished. `after()`
 * tells Vercel to keep this request alive until the update is done.
 * Call it only from pages, layouts or actions (it needs a request).
 */
export function scheduleDatabaseUpdate() {
  try {
    after(async () => {
      try { await ensureSchema(0); } catch (e) { console.error('Database update could not run:', e); }
    });
  } catch {
    // Not inside a request (for example during a build): nothing to do.
  }
}
