// "Open in Maps" (D-37): a plain link. Nothing is requested from the map provider until the guest taps it.
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}