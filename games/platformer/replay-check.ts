/**
 * Replays solve-L<n>.json through the real engine (physics.ts step) headless.
 * usage (from the repo root):
 *   npx tsx games/platformer/replay-check.ts games/platformer/seed.json games/platformer/solves 1 2
 * exits 1 unless every level clears with 0 deaths and every coin, at each start delay.
 */
import { readFileSync } from "node:fs"
import { buildLevel, type LevelDef } from "@/games/platformer/runtime"
import { initialSim, step } from "@/games/platformer/physics"

const DIRS: Record<string, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  "-": { x: 0, y: 0 },
}

export type SolveFile = {
  levelId: string
  playerSpeed: number
  inputs: [string, number][]
}

export type ReplayRow = {
  id: string
  delay: number
  cleared: boolean
  deaths: number
  coins: number
  total: number
  frame: number
  ok: boolean
}

export function readLevelDefs(path: string): LevelDef[] {
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    levels?: LevelDef[]
    snapshot?: { content?: { levels?: LevelDef[] } }
  }
  const levels = data.levels ?? data.snapshot?.content?.levels
  if (!levels) throw new Error(`${path} has no levels`)
  return levels
}

export function replaySolves(defs: LevelDef[], solveDir: string, delays: number[], coinRadius = 12): ReplayRow[] {
  const rows: ReplayRow[] = []
  defs.forEach((def, index) => {
    const sol = JSON.parse(readFileSync(`${solveDir}/solve-L${index + 1}.json`, "utf8")) as SolveFile
    if (sol.levelId !== def.id) throw new Error(`solve-L${index + 1} is for ${sol.levelId}, not ${def.id}`)
    const level = buildLevel(def, coinRadius)
    for (const delay of delays) {
      let sim = initialSim(level)
      let deaths = 0
      const seq: string[] = Array(delay).fill("-")
      for (const [dir, ticks] of sol.inputs) {
        for (let k = 0; k < ticks; k++) seq.push(dir)
      }
      for (const code of seq) {
        const dir = DIRS[code]
        if (!dir) throw new Error(`unknown input ${code}`)
        const result = step(sim, dir, level, sol.playerSpeed)
        if (result.events.died) deaths++
        sim = result.sim
        if (sim.cleared) break
      }
      const coins = sim.coins.filter(Boolean).length
      const ok = sim.cleared && deaths === 0 && sim.coins.every(Boolean)
      rows.push({
        id: def.id,
        delay,
        cleared: sim.cleared,
        deaths,
        coins,
        total: level.coins.length,
        frame: sim.frame,
        ok,
      })
    }
  })
  return rows
}

const isMain = process.argv[1]?.endsWith("replay-check.ts")
if (isMain) {
  const [levelsPath, dir, ...lateArgs] = process.argv.slice(2)
  if (!levelsPath || !dir) {
    console.error("usage: npx tsx games/platformer/replay-check.ts <levels.json|seed.json> <solve-dir> [lateTicks...]")
    process.exit(1)
  }
  const delays = [0, ...lateArgs.map(Number)]
  const rows = replaySolves(readLevelDefs(levelsPath), dir, delays)
  let failed = false
  for (const row of rows) {
    console.log(
      `${row.id} delay ${row.delay}: cleared=${row.cleared} deaths=${row.deaths} coins=${row.coins}/${row.total} frame=${row.frame} ${row.ok ? "ok" : "FAIL"}`,
    )
    if (!row.ok) failed = true
  }
  process.exit(failed ? 1 : 0)
}
