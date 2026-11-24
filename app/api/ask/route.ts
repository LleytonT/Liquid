import { planAsk } from "@/lib/ask/plan"
import { rulesFor } from "@/lib/ask/tweak"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "the ask was not json" }, { status: 400 })
  }
  const ask = body && typeof body === "object" && "ask" in body ? body.ask : null
  const gameId = body && typeof body === "object" && "gameId" in body ? body.gameId : null
  if (typeof ask !== "string" || typeof gameId !== "string" || !rulesFor(gameId)) {
    return Response.json({ error: "say which game and what should change" }, { status: 400 })
  }
  const plan = await planAsk(gameId, ask.trim().slice(0, 140))
  return Response.json(plan)
}
