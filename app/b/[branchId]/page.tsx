import { Suspense } from "react"
import { notFound } from "next/navigation"
import { PlayShell } from "@/components/play-shell"
import { branchById, catalog } from "@/games/catalog"
import { Atmosphere } from "@/lib/shell/atmosphere"

export function generateStaticParams() {
  return catalog.flatMap((game) => game.seed.branches.map((branch) => ({ branchId: branch.id })))
}

export default function Page({ params }: { params: Promise<{ branchId: string }> }) {
  return (
    <Suspense
      fallback={
        <Atmosphere>
          <p className="label px-5 py-4 text-lg">liquid</p>
        </Atmosphere>
      }
    >
      <BranchPlay params={params} />
    </Suspense>
  )
}

async function BranchPlay({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params
  const found = branchById(branchId)
  if (!found) notFound()
  found.game.bible.prepare(found.branch)
  return <PlayShell gameId={found.game.id} branchId={found.branch.id} />
}
