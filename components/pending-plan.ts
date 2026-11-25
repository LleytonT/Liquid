export type PendingPlan = {
  route: "tweak" | "content" | "branch" | "clarify"
  confidence: number
  summary: string
  question?: string
  branchId: string | null
  warning: string | null
}
