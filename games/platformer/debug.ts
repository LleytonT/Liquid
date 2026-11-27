/** QA readout. Open /b/seed?debug=1. The data attributes stay on either way. */
export function debugMode(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search
  return new URLSearchParams(query).get("debug") === "1"
}
