import { PlayShell } from "@/components/play-shell"
import { defaultPlay } from "@/games/catalog"

export default function Page() {
  const { game, branch } = defaultPlay()
  game.bible.prepare(branch)
  return <PlayShell gameId={game.id} branchId={branch.id} />
}
