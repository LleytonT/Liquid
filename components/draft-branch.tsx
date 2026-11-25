import Link from "next/link"
import { BranchBrowser, type TreeNodeData } from "@/components/branch-browser"
import { TraceStrip, type TraceView } from "@/components/trace-strip"
import { Atmosphere } from "@/lib/shell/atmosphere"

export function DraftBranch({
  title,
  ask,
  plan,
  ownerId,
  parentId,
  trace,
  tree,
}: {
  title: string
  ask: string
  plan: string
  ownerId: string
  parentId: string
  trace: TraceView | null
  tree: TreeNodeData[]
}) {
  return (
    <Atmosphere>
      <main data-draft-branch className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
        <p className="label text-sm" data-owner={ownerId}>
          {ownerId}
        </p>
        <h1 className="text-3xl tracking-tight">{title}</h1>
        <p data-ask className="text-base leading-6">
          {ask}
        </p>
        <p data-plan className="text-base leading-6">
          {plan}
        </p>
        {trace ? <TraceStrip trace={trace} /> : null}
        <Link href={`/b/${parentId}`} className="label underline">
          back to the parent
        </Link>
        <section>
          <h2 className="label text-[12px] font-bold">remix tree</h2>
          <div className="mt-3">
            <BranchBrowser initial={tree} />
          </div>
        </section>
      </main>
    </Atmosphere>
  )
}
