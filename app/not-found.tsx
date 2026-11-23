import Link from "next/link"
import { Atmosphere } from "@/lib/shell/atmosphere"

export default function NotFound() {
  return (
    <Atmosphere>
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 px-6">
        <p className="label text-lg">liquid</p>
        <h1 className="text-3xl tracking-tight">that branch is not on the shelf</h1>
        <Link href="/" className="label underline">
          back to the root
        </Link>
        <Link href="/shelf" className="label underline">
          shelf
        </Link>
      </main>
    </Atmosphere>
  )
}
