/**
 * `@telegram-apps/telegram-ui` ships only a handful of generic UI glyphs (close, edit, chat...) —
 * no wallet/scan/profile set. Tabbar/Section icons use `currentColor` so they inherit the kit's
 * own selected/unselected tint automatically (see Tabbar.Item's CSS) without any theming glue.
 */
type IconProps = { size?: number; className?: string };

export function WalletIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="7" width="22" height="15" rx="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 11.5h22" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="19.5" cy="16.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function ProfileIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <circle cx="14" cy="9.5" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 23c1.2-4.8 5-7 8.5-7s7.3 2.2 8.5 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MintIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <path
        d="M14 3l2.4 2.4 3.3-.6.6 3.3L23 10.5 20.6 14 23 17.5l-2.7 1.4-.6 3.3-3.3-.6L14 25l-2.4-2.4-3.3.6-.6-3.3L5 17.5 7.4 14 5 10.5l2.7-1.4.6-3.3 3.3.6L14 3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 14.3l2.3 2.3 4.5-5.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScanIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="14" cy="14" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <path d="M14 14V5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="14" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}
