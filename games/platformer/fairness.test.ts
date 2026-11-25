import assert from "node:assert/strict"
import { test } from "node:test"
import seed from "./seed.json"
import unfair from "./fixtures/unfair-73295b1.json"
import { buildLevel, type LevelDef } from "./runtime"
import { FAIR_CLEARANCE_PX, FAIR_TWIN_TICKS, proveLattice } from "./lattice"
import type { BranchRecord } from "@/lib/shell/game-module"

const coinRadius = (seed as BranchRecord).snapshot.tunables.coinRadiusPx.value

function prove(def: LevelDef, marginPx: number, twinTicks: number) {
  const level = buildLevel(def, coinRadius)
  const started = performance.now()
  const proof = proveLattice(level, 120, { marginPx, twinTicks, trace: false })
  return { proof, ms: performance.now() - started }
}

test("new levels clear the 4px and 100ms fairness floor", () => {
  const defs = ((seed as BranchRecord).snapshot.content as { levels: LevelDef[] }).levels
  assert.equal(FAIR_CLEARANCE_PX, 4)
  assert.equal(FAIR_TWIN_TICKS, 3)
  assert.ok((2 * FAIR_TWIN_TICKS + 1) * (1000 / 60) >= 100)
  for (const def of defs) {
    const { proof, ms } = prove(def, FAIR_CLEARANCE_PX, FAIR_TWIN_TICKS)
    console.log(`fairness ${def.id} ${proof.ok ? "pass" : "FAIL"} ${proof.reason} ${ms.toFixed(0)}ms`)
    assert.equal(proof.ok, true, `${def.id} ${proof.reason}`)
  }
})

test("the fairness gate rejects pair and halls from 73295b1", () => {
  for (const def of unfair.levels as LevelDef[]) {
    const plain = prove(def, 0, 0)
    const fair = prove(def, FAIR_CLEARANCE_PX, FAIR_TWIN_TICKS)
    console.log(
      `fairness ${def.id} (73295b1) plain ${plain.proof.ok ? "pass" : "FAIL"} ${plain.ms.toFixed(0)}ms; 4px ±3 ${fair.proof.ok ? "pass" : "FAIL"} ${fair.proof.reason} ${fair.ms.toFixed(0)}ms`,
    )
    assert.equal(plain.proof.ok, true, `${def.id} should still be finishable without the floor`)
    assert.equal(fair.proof.ok, false, `${def.id} should fail the 4px / ±3 tick floor`)
    assert.match(fair.proof.reason, /fixed point/)
  }
})
