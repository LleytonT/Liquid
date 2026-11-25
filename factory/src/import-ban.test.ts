import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const banned = ["@liquid/" + "platformer", "@liquid/" + "words", "@/games", "/games/", "games/"]

function files(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) found.push(...files(full))
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) found.push(full)
  }
  return found
}

function specifiers(source: string): string[] {
  const out: string[] = []
  const patterns = [
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) out.push(match[1])
    }
  }
  return out
}

test("factory code does not import games", () => {
  const hits: string[] = []
  for (const file of files(root)) {
    const source = readFileSync(file, "utf8")
    for (const specifier of specifiers(source)) {
      if (banned.some((piece) => specifier.includes(piece))) {
        hits.push(`${path.relative(root, file)} imports ${specifier}`)
      }
    }
  }
  assert.deepEqual(hits, [])
})

test("the router does not know about owners", () => {
  const source = readFileSync(path.join(root, "src/router.ts"), "utf8")
  assert.equal(source.includes("OwnerIdentity"), false)
  assert.equal(source.includes("anonId"), false)
})
