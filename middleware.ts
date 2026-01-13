import createMiddleware from 'next-intl/middleware';
import { routing } from './lib/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files (images, fonts, etc.)
  // - Next.js internals (_next)
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Also match the root
    '/'
  ]
};
