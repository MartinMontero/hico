import { generate } from 'lean-qr';

/** The code as a standalone SVG document: black on white with a four-module quiet zone, so it scans whatever the page theme is. */
export function qrSvg(text: string): string {
  const code = generate(text);
  const quiet = 4;
  const total = code.size + quiet * 2;
  let d = '';
  for (let y = 0; y < code.size; y++) {
    let run = 0;
    for (let x = 0; x <= code.size; x++) {
      if (x < code.size && code.get(x, y)) run++;
      else if (run > 0) {
        d += `M${x - run + quiet} ${y + quiet}h${run}v1h-${run}z`;
        run = 0;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** A QR code (lean-qr, MIT, no dependencies; D-29) as an image. `label` is its text alternative: where the code leads. */
export function QrCode({ text, label, size = 224 }: { text: string; label: string; size?: number }) {
  return <img class="qr" src={`data:image/svg+xml,${encodeURIComponent(qrSvg(text))}`} alt={label} width={size} height={size} />;
}
