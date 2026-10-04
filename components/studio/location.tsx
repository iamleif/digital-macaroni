import { LOCATION } from "./site";

/** Footer sign-off: where the studio is, with a small Norwegian flag. */
export function Location() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
    <svg width={18} height={13} viewBox="0 0 22 16" role="img" aria-label="Flag of Norway" style={{ borderRadius: 2, boxShadow: "0 0 0 1px rgba(15, 15, 13, 0.08)", flex: "none" }}>
      <rect width="22" height="16" fill="#ba0c2f" />
      <path d="M6 0h4v16H6zM0 6h22v4H0z" fill="#fff" />
      <path d="M7 0h2v16H7zM0 7h22v2H0z" fill="#00205b" />
    </svg>
    {LOCATION.city}, {LOCATION.country}
  </span>;
}
