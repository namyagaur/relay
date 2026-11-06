export default function RelayLogo({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="5.2" cy="12" r="2.3" fill="currentColor" />
      <path
        d="M9.4 8.1a5.5 5.5 0 0 1 0 7.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M13.1 4.6a10.4 10.4 0 0 1 0 14.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}