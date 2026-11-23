import type { Metadata } from "next"
import { ShelfScreen } from "@/components/shelf-screen"

export const metadata: Metadata = {
  title: "shelf · liquid",
}

export default function ShelfPage() {
  return <ShelfScreen />
}
