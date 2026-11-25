import { catalog } from "../games/catalog"
import seed from "../games/platformer/seed.json"
import { fairnessPlatformer } from "../games/platformer/solve"
import type { BranchRecord } from "../lib/shell/game-module"

let failed = false

for (const game of catalog) {
  const started = performance.now()
  let results
  try {
    results = game.solver.run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${game.id}  fail  ${message}`)
    failed = true
    continue
  }
  for (const result of results) {
    const mark = result.ok ? "ok" : "fail"
    const extra = result.notes.length ? `  ${result.notes.join("  ")}` : ""
    console.log(`${game.id}  ${result.levelId}  ${mark}${extra}`)
    if (!result.ok) failed = true
  }
  const passed = results.filter((result) => result.ok).length
  const elapsed = performance.now() - started
  console.log(`${game.id}  ${passed}/${results.length} finishable  ${elapsed.toFixed(0)}ms`)
}

const fairStarted = performance.now()
try {
  const fair = fairnessPlatformer(seed as BranchRecord)
  for (const result of fair) {
    const mark = result.ok ? "ok" : "fail"
    console.log(`platformer  ${result.levelId}  fairness ${mark}  ${result.notes.join("  ")}`)
    if (!result.ok) failed = true
  }
  const passed = fair.filter((result) => result.ok).length
  console.log(
    `platformer  fairness ${passed}/${fair.length}  ${(performance.now() - fairStarted).toFixed(0)}ms`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`platformer  fairness fail  ${message}`)
  failed = true
}

if (failed) process.exit(1)
