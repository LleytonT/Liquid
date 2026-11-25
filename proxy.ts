import { isFactoryBranchId } from "@liquid/factory/ids"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { KNOWN_BRANCH_IDS } from "@/lib/shell/known-branches"

export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/b\/([^/]+)\/?$/)
  if (!match) return NextResponse.next()
  const id = decodeURIComponent(match[1] ?? "")
  if (KNOWN_BRANCH_IDS.has(id) || isFactoryBranchId(id)) return NextResponse.next()
  return NextResponse.rewrite(new URL("/unknown-branch", request.url))
}

export const config = {
  matcher: ["/b/:path*"],
}
