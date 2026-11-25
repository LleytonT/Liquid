import { AskError, openAsk } from "@liquid/factory/ask"
import { anonOwnerSource } from "@liquid/factory/owner"
import { getStore } from "@liquid/factory/store"
import { adapterFor } from "@/lib/registry"

export const maxDuration = 30

function persistence() {
  const selected = getStore()
  return {
    selected,
    body: { kind: selected.kind, warning: selected.warning, durable: selected.durable },
  }
}

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
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const ask = record.ask
  const gameId = record.gameId
  const parentId = record.parentId
  if (typeof ask !== "string" || typeof gameId !== "string" || typeof parentId !== "string") {
    return Response.json({ error: "say which game and what should change" }, { status: 400 })
  }
  const trimmed = ask.trim()
  if (!trimmed) return Response.json({ error: "describe a twist first" }, { status: 400 })
  const adapter = adapterFor(gameId)
  if (!adapter) return Response.json({ error: "say which game and what should change" }, { status: 400 })
  const { selected, body: persistenceBody } = persistence()
  try {
    const opened = await openAsk({
      adapter,
      store: selected.store,
      owner: anonOwnerSource.identify({ anonId: typeof record.anonId === "string" ? record.anonId : null }),
      parentId,
      ask: trimmed,
      current: readCurrent(record.current),
    })
    return Response.json({
      route: opened.route.route,
      confidence: opened.route.confidence,
      plan: opened.route.plan,
      branch: opened.branch,
      trace: opened.trace,
      persistence: persistenceBody,
    })
  } catch (error) {
    if (error instanceof AskError) return Response.json({ error: error.message }, { status: error.status })
    throw error
  }
}
