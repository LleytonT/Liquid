import type { OwnerIdentity } from "./owner"

export type BranchKind = "tweak" | "content" | "branch"
export type BranchStatus = "draft" | "playable" | "proposed" | "merged" | "rejected"
export type BranchVisibility = "personal" | "shared" | "proposed"

/**
 * A node on a game's tree. The seed of that game is the root.
 * `patch` is only this node's change against its parent. Full game data is not stored.
 */
export type Branch = {
  readonly id: string
  readonly parentId: string
  readonly gameId: string
  readonly ask: string
  readonly kind: BranchKind
  readonly patch: Readonly<Record<string, number>> | null
  readonly plan: string
  readonly authorId: string
  readonly createdAt: string
  readonly status: BranchStatus
  readonly visibility: BranchVisibility
  readonly traceId: string
}

export const BRANCH_FIELDS = [
  "id",
  "parentId",
  "gameId",
  "ask",
  "kind",
  "patch",
  "plan",
  "authorId",
  "createdAt",
  "status",
  "visibility",
  "traceId",
] as const

export function createBranch(input: {
  id: string
  parentId: string
  gameId: string
  ask: string
  kind: BranchKind
  patch: Readonly<Record<string, number>> | null
  plan: string
  owner: OwnerIdentity
  createdAt: string
  status: BranchStatus
  traceId: string
}): Branch {
  return {
    id: input.id,
    parentId: input.parentId,
    gameId: input.gameId,
    ask: input.ask,
    kind: input.kind,
    patch: input.patch ? { ...input.patch } : null,
    plan: input.plan,
    authorId: input.owner.id,
    createdAt: input.createdAt,
    status: input.status,
    visibility: "personal",
    traceId: input.traceId,
  }
}
