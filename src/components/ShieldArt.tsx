/** Decorative shield and weather illustration. Original artwork, no lender branding. */
export function ShieldArt() {
  return (
    <div className="shield" aria-hidden="true">
      <svg viewBox="0 0 96 100" width="68" height="71">
        <defs>
          <linearGradient id="shield-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2dd4bf" />
            <stop offset="0.55" stopColor="#0f766e" />
            <stop offset="1" stopColor="#065f56" />
          </linearGradient>
          <radialGradient id="shield-sun" cx="0.35" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </radialGradient>
          <linearGradient id="shield-cloud" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9eeea" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="94" rx="24" ry="4" fill="rgba(15, 23, 42, 0.14)" />
        <path d="M48 6 80 18v28c0 20-14 34-32 42C30 80 16 66 16 46V18z" fill="#064e47" transform="translate(4 4)" />
        <path d="M48 6 80 18v28c0 20-14 34-32 42C30 80 16 66 16 46V18z" fill="url(#shield-face)" />
        <path d="M48 6 16 18v28c0 20 14 34 32 42z" fill="rgba(255, 255, 255, 0.16)" />
        <circle cx="57" cy="36" r="11" fill="url(#shield-sun)" />
        <path d="M33 62a8 8 0 0 1 3-15 11 11 0 0 1 21-1 8 8 0 0 1 3 16z" fill="url(#shield-cloud)" />
        <path d="M40 67l-2 5M48 67l-2 5M56 67l-2 5" stroke="#a7f3d0" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
