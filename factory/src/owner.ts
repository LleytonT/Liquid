/**
 * Who a branch belongs to.
 * Sign-in replaces `anonOwnerSource`. Branch records and the router stay as they are.
 * Authored seed roots use `ROOT_OWNER`. They are roots of each game's tree, not a trunk.
 */
export interface OwnerIdentity {
  readonly id: string
}

export const ROOT_OWNER: OwnerIdentity = { id: "lleyton" }

export interface OwnerSource {
  identify(input: { readonly anonId?: string | null }): OwnerIdentity
}

const ANON_ID = /^[A-Za-z0-9_-]{8,80}$/

/** The browser sends an anonymous id. A missing or odd id becomes "anon". */
export const anonOwnerSource: OwnerSource = {
  identify({ anonId }) {
    if (!anonId || !ANON_ID.test(anonId)) return { id: "anon" }
    return { id: anonId }
  },
}
