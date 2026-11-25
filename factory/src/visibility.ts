import type { Branch, BranchVisibility } from "./branch"

export type ShareVisibility = "shared" | "proposed"

/**
 * A future verifier runs only when a branch is shared or proposed.
 * Personal branches are instant and never call this.
 */
export interface VisibilityHook {
  review(input: { readonly branchId: string; readonly visibility: ShareVisibility }): Promise<{
    readonly evidence: unknown
  }>
}

/** The live hook. Share and propose throw. Personal never reaches it. */
export const notLiveVisibilityHook: VisibilityHook = {
  review() {
    return Promise.reject(new Error("share and propose are not live. personal branches skip this hook."))
  },
}

export async function requestVisibility(
  branch: Branch,
  visibility: BranchVisibility,
  hook: VisibilityHook = notLiveVisibilityHook,
): Promise<{ branch: Branch; evidence: unknown }> {
  if (visibility === "personal") {
    return { branch: { ...branch, visibility: "personal" }, evidence: null }
  }
  const review = await hook.review({ branchId: branch.id, visibility })
  return { branch: { ...branch, visibility }, evidence: review.evidence }
}
