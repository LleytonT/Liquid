/** A refusal names the kind of change, instead of one line for every miss. */
export function refusalLine(ask: string): string {
  const text = ask.toLowerCase()
  if (/\b(jump|jumping|higher|new move|moves)\b/.test(text)) return "jumping higher isn't a change this game can make."
  if (/\b(multiplayer|two players|2 players|co-op|coop)\b/.test(text)) return "multiplayer isn't live."
  if (/\b(weather|rain|snow|art|palette|colour|color)\b/.test(text)) return "weather and art aren't changes you can ask for."
  if (/\b(easier|easy)\b/.test(text) && /\blevel/.test(text)) return "easier levels aren't live yet."
  if (/\b(level|levels)\b/.test(text)) return "new levels aren't live yet."
  return "that change isn't live yet. try a tweak like speed, guesses, or the timer."
}
