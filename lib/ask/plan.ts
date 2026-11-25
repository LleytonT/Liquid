import { routeAsk } from "@liquid/factory"
import { adapterFor } from "@/lib/registry"
import { toAskPlan, type AskPlan } from "@/lib/ask/tweak"

export { ASK_MODEL, modelOutputSchema, parseModelOutput, parseModelText, strictModelSchema } from "@liquid/factory"

type AskModel = (gameId: string, ask: string, current?: Record<string, number>) => Promise<AskPlan>

function adapter(gameId: string) {
  const found = adapterFor(gameId)
  if (!found) throw new Error(`no adapter for ${gameId}`)
  return found
}

/**
 * The model runs for every ask. The word matcher runs only when that call errors or times out.
 * The classification itself is routeAsk.
 */
export async function planAsk(
  gameId: string,
  ask: string,
  current?: Record<string, number>,
  complete?: AskModel,
): Promise<AskPlan> {
  const game = adapter(gameId)
  if (complete) {
    try {
      return await complete(gameId, ask, current)
    } catch (error) {
      const thrown = error instanceof Error ? error : new Error("error")
      const result = await routeAsk(
        game,
        ask,
        async () => {
          throw thrown
        },
        current,
      )
      return toAskPlan(result)
    }
  }
  return toAskPlan(await routeAsk(game, ask, undefined, current))
}
