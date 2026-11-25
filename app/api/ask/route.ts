import { planAsk } from "@/lib/ask/plan"
import { rulesFor } from "@/lib/ask/tweak"

export const maxDuration = 30

function readCurrent(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined
  const current: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) current[key] = item
  }
  return Object.keys(current).length > 0 ? current : undefined
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "the ask was not json" }, { status: 400 })
  }
  const record = body && typeof body === "object" ? body : null
  const ask = record && "ask" in record ? record.ask : null
  const gameId = record && "gameId" in record ? record.gameId : null
  if (typeof ask !== "string" || typeof gameId !== "string" || !rulesFor(gameId)) {
    return Response.json({ error: "say which game and what should change" }, { status: 400 })
  }
  const trimmed = ask.trim()
  if (!trimmed) return Response.json({ error: "describe a twist first" }, { status: 400 })
  const plan = await planAsk(gameId, trimmed.slice(0, 140), readCurrent(record && "current" in record ? record.current : undefined))
  return Response.json(plan)
}
