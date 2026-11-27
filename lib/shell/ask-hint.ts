export const ASK_HINT = "pause (p) to change this game by asking"
export const ASK_HINT_KEY = "liquid_ask_hint_seen"
export const ASK_HINT_MS = 8000

export function askHintVisible(unseen: boolean, paused: boolean, howtoOpen: boolean): boolean {
  return unseen && !paused && !howtoOpen
}
