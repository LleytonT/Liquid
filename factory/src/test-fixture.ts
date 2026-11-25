import type { GameAdapter, GameData } from "./contract"

type Body = { values: Record<string, number> }

export function testAdapter(spies?: { hot?: () => void; write?: () => void }): GameAdapter {
  return {
    contractVersion: 1,
    id: "platformer",
    exampleTweak: "make the blue shapes slower",
    baseline: { speed: 120, scale: 1, guesses: 6, enemySpeedScale: 1 },
    tweaks: [
      { key: "speed", min: 100, max: 140 },
      { key: "scale", min: 0.45, max: 1.5 },
      { key: "guesses", min: 3, max: 10 },
      { key: "enemySpeedScale", min: 0.45, max: 1.5 },
    ],
    fallbackHints: [
      { pattern: "blue shapes slower", patch: { enemySpeedScale: 0.55 } },
      { pattern: "blue dots faster", patch: { enemySpeedScale: 1.4 } },
      { pattern: "square slower", patch: { speed: 100 } },
      { pattern: "\\b(\\d+)\\s+guess", patch: { guesses: 6 }, capture: "guesses" },
      { pattern: "fewer guesses", patch: { guesses: 5 } },
      { pattern: "no timer", patch: { speed: 100 } },
    ],
    load(id) {
      if (id !== "seed") return null
      return { id: "seed", parentId: null, title: "seed", body: { values: { speed: 120 } } satisfies Body }
    },
    read(data) {
      const body = data.body as Body
      return { tunables: { ...body.values }, summary: data.title }
    },
    write(data, patch) {
      spies?.write?.()
      const body = data.body as Body
      return { ...data, body: { values: { ...body.values, ...patch } } }
    },
    hotApply(data, patch) {
      spies?.hot?.()
      return { when: "live", data: this.write(data, patch) }
    },
    withIdentity(data, meta) {
      return { ...data, id: meta.id, parentId: meta.parentId, title: meta.title }
    },
    already(key, value) {
      return `${key} is already ${value}`
    },
    refusal(ask) {
      const text = ask.toLowerCase()
      if (/\bjump/.test(text)) return "jumping higher isn't a change this game can make."
      if (/\blevel/.test(text)) return "new levels aren't live yet."
      return "that change isn't live yet."
    },
    describePatch(patch) {
      return Object.entries(patch)
        .map(([key, value]) => `${key} ${value}`)
        .join(", ")
    },
    runHeadless() {
      return { ticks: 0, done: false, summary: "" }
    },
    listInvariants() {
      return [{ id: "finishable", summary: "every level is finishable" }]
    },
    screenshot() {
      return { supported: false, reason: "stub" }
    },
  }
}

export function readValues(data: GameData): Record<string, number> {
  return { ...((data.body as Body).values) }
}
