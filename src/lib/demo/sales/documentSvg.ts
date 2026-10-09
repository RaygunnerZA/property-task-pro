function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderRecordSvg(input: {
  eyebrow: string;
  title: string;
  issuer: string;
  reference: string;
  dateLabel: string;
  lines: string[];
}): string {
  const lines = input.lines.slice(0, 6).map((line, index) => {
    const y = 360 + index * 42;
    return `<text x="88" y="${y}" fill="#24312c" font-family="Georgia, serif" font-size="22">${escapeXml(line)}</text>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#f4efe6"/>
  <rect x="48" y="48" width="804" height="1104" rx="8" fill="#fffdf8" stroke="#c9bfb0" stroke-width="2"/>
  <rect x="48" y="48" width="804" height="16" fill="#8EC9CE"/>
  <text x="88" y="140" fill="#5d6b66" font-family="Georgia, serif" font-size="18" letter-spacing="2">${escapeXml(input.eyebrow.toUpperCase())}</text>
  <text x="88" y="200" fill="#1c2421" font-family="Georgia, serif" font-size="36">${escapeXml(input.title)}</text>
  <text x="88" y="260" fill="#3d4a45" font-family="Georgia, serif" font-size="22">${escapeXml(input.issuer)}</text>
  <text x="88" y="300" fill="#6a6156" font-family="Georgia, serif" font-size="18">${escapeXml(input.reference)} · ${escapeXml(input.dateLabel)}</text>
  <line x1="88" y1="328" x2="812" y2="328" stroke="#e4ddd2" stroke-width="2"/>
  ${lines.join("\n  ")}
</svg>`;
}

/** Kitchen riser with a visible drip. Used only for the two hero leak photos. */
export function renderLeakPhotoSvg(caption: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#efe6d8"/>
  <rect x="70" y="70" width="1060" height="620" rx="18" fill="#f7f1e7"/>
  <rect x="120" y="150" width="420" height="460" rx="8" fill="#d7c4a8"/>
  <rect x="150" y="190" width="160" height="150" rx="4" fill="#c4ad8e"/>
  <rect x="340" y="190" width="160" height="150" rx="4" fill="#c4ad8e"/>
  <rect x="150" y="370" width="350" height="18" fill="#b08968"/>
  <rect x="560" y="120" width="28" height="430" rx="8" fill="#b87333"/>
  <rect x="520" y="250" width="110" height="22" rx="8" fill="#c9844a"/>
  <ellipse cx="574" cy="560" rx="16" ry="26" fill="#7eb6c9"/>
  <ellipse cx="574" cy="610" rx="10" ry="16" fill="#8ec9ce"/>
  <circle cx="574" cy="648" r="7" fill="#8ec9ce"/>
  <text x="120" y="660" fill="#3c342c" font-family="Georgia, serif" font-size="28">${escapeXml(caption)}</text>
</svg>`;
}
