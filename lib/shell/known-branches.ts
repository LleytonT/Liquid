/** Branch ids the shelf can open. Proxy uses this list to 404 anything else before render. */
export const KNOWN_BRANCH_IDS: ReadonlySet<string> = new Set([
  "seed",
  "words",
  "words-hard",
  "words-eight",
  "words-timed",
])
