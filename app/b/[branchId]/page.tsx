import { notFound } from "next/navigation"
import { PlayShell } from "@/components/play-shell"
import { branchById, catalog } from "@/games/catalog"

export function generateStaticParams() {
  return catalog.flatMap((game) => game.seed.branches.map((branch) => ({ branchId: branch.id })))
}

export default async function Page({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params
  const found = branchById(branchId)
  if (!found) notFound()
  found.game.bible.prepare(found.branch)
  return <PlayShell gameId={found.game.id} branchId={found.branch.id} />
}
