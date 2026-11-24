/** Fired when a player’s ask becomes a branch. Nothing raises this until asks build branches. */
export const BRANCH_CREATED_EVENT = "liquid:branch-created"

export const BRANCH_TIP_KEY = "branch_tip_seen"

export function notifyBranchCreated(): void {
  window.dispatchEvent(new Event(BRANCH_CREATED_EVENT))
}
