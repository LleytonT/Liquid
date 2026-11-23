import { catalog } from "../games/catalog"

let failed = false

for (const game of catalog) {
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
  console.log(`${game.id}  ${passed}/${results.length} finishable`)
}

if (failed) process.exit(1)
