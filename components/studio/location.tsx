/** Twelve stars on a circle a third of the flag's height, as on the flag of Europe. */
const EU_STARS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return [13.5 + 6 * Math.sin(a), 9 - 6 * Math.cos(a)].map((n) => Math.round(n * 100) / 100);
});

/** A five-pointed star centred on x, y. */
function star(x: number, y: number, r = 1) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5, d = i % 2 ? r * 0.4 : r;
    return `${(x + d * Math.sin(a)).toFixed(2)},${(y - d * Math.cos(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

const flag = { borderRadius: 2, boxShadow: "0 0 0 1px rgba(15, 15, 13, 0.08)", flex: "none" } as const;

/** Footer line under the logo: where the studio works, with small flags. */
export function Places() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <svg width={19} height={13} viewBox="0 0 19 13" role="img" aria-label="Flag of the United States" style={flag}>
      <rect width="19" height="13" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={i} width="19" height="1" fill="#b31942" />)}
      <rect width="7.6" height="7" fill="#0a3161" />
    </svg>
    <svg width={19} height={13} viewBox="0 0 27 18" role="img" aria-label="Flag of Europe" style={flag}>
      <rect width="27" height="18" fill="#003399" />
      {EU_STARS.map(([x, y]) => <path key={`${x},${y}`} d={star(x, y)} fill="#ffcc00" />)}
    </svg>
    <span style={{ marginLeft: 2 }}>Working across the US and Europe</span>
  </span>;
}
