import { Suspense } from "react"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { isFactoryBranchId } from "@liquid/factory/ids"
import { ROOT_OWNER } from "@liquid/factory/owner"
import { getStore } from "@liquid/factory/store"
import type { Branch, Trace } from "@liquid/factory/types"
import { DraftBranch } from "@/components/draft-branch"
import { PlayShell } from "@/components/play-shell"
import type { TraceView } from "@/components/trace-strip"
import { branchById, catalog, gameById } from "@/games/catalog"
import { materialize } from "@/lib/materialize"
import { listTree } from "@/lib/tree"

export function generateStaticParams() {
  return catalog.flatMap((game) => game.seed.branches.map((branch) => ({ branchId: branch.id })))
}

function traceView(trace: Trace | null): TraceView | null {
  if (!trace) return null
  return {
    id: trace.id,
    route: trace.route,
    confidence: trace.confidence,
    summary: trace.plan.summary,
    diff: trace.diff ? { ...trace.diff } : null,
    checks: trace.checks,
    evidence: trace.evidence ?? null,
    verdict: trace.verdict,
    decision: trace.decision,
  }
}

function draftTitle(branch: Branch): string {
  if (branch.status === "rejected") return "this ask was rejected"
  if (branch.kind === "tweak") return "this plan is not applied yet"
  return "this isn't built yet"
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>
  searchParams: Promise<{ debug?: string | string[] }>
}) {
  const { branchId } = await params
  const found = branchById(branchId)
  if (found) {
    found.game.bible.prepare(found.branch)
    const parent = found.branch.parentId
      ? (found.game.seed.branches.find((item) => item.id === found.branch.parentId) ?? null)
      : null
    return (
      <PlayShell
        gameId={found.game.id}
        branch={found.branch}
        parent={parent}
        ownerId={ROOT_OWNER.id}
        trace={null}
      />
    )
  }
  if (!isFactoryBranchId(branchId)) notFound()
  return (
    <Suspense fallback={<p className="px-6 py-8">loading branch</p>}>
      <StoredBranch branchId={branchId} searchParams={searchParams} />
    </Suspense>
  )
}

function debugOn(value: string | string[] | undefined): boolean {
  const flag = Array.isArray(value) ? value[0] : value
  return flag === "1"
}

async function StoredBranch({
  branchId,
  searchParams,
}: {
  branchId: string
  searchParams: Promise<{ debug?: string | string[] }>
}) {
  await connection()
  const { store } = getStore()
  const [branch, query] = await Promise.all([store.getBranch(branchId), searchParams])
  if (!branch) notFound()
  const [trace, tree] = await Promise.all([store.getTrace(branch.traceId), listTree()])
  const view = debugOn(query.debug) ? traceView(trace) : null
  if (branch.status !== "playable") {
    return (
      <DraftBranch
        title={draftTitle(branch)}
        ask={branch.ask}
        plan={branch.status === "rejected" ? "nothing was applied." : branch.plan}
        ownerId={branch.authorId}
        parentId={branch.parentId}
        trace={view}
        tree={tree}
      />
    )
  }
  const game = gameById(branch.gameId)
  if (!game) notFound()
  let played: Awaited<ReturnType<typeof materialize>> | null = null
  let failure: string | null = null
  try {
    played = await materialize(branch)
    game.bible.prepare(played.record)
  } catch (error) {
    failure = error instanceof Error ? error.message : "this branch does not resolve"
    played = null
  }
  if (!played) {
    return (
      <DraftBranch
        title="this branch does not resolve"
        ask={branch.ask}
        plan={failure ?? "this branch does not resolve"}
        ownerId={branch.authorId}
        parentId={branch.parentId}
        trace={view}
        tree={tree}
      />
    )
  }
  return (
    <PlayShell
      gameId={branch.gameId}
      branch={played.record}
      parent={played.parent}
      ownerId={branch.authorId}
      trace={view}
      tree={tree}
    />
  )
}
