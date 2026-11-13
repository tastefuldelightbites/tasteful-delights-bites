/** Footer "Follow us" with Instagram and Facebook icons (open in a new tab). */
export const INSTAGRAM_URL = 'https://instagram.com/tastefuldelightsbites';
export const FACEBOOK_URL = 'FACEBOOK_URL_PENDING';

export function SocialLinks() {
  return (
    <div className="social">
      <p className="social-title">Follow us</p>
      <div className="social-icons">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Tasteful Delights Bites on Instagram (opens in a new tab)">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Tasteful Delights Bites on Facebook (opens in a new tab)">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
