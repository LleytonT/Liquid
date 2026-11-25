import { connection } from "next/server"
import { getStore } from "@liquid/factory/store"
import { listTree } from "@/lib/tree"

export async function GET() {
  await connection()
  const selected = getStore()
  const branches = await listTree()
  return Response.json({
    branches,
    persistence: { kind: selected.kind, warning: selected.warning, durable: selected.durable },
  })
}
