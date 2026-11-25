import { randomBytes } from "node:crypto"

/** Player-made branch ids. Authored seeds stay on their own ids. */
export function isFactoryBranchId(id: string): boolean {
  return /^br_[0-9a-f]{12}$/.test(id)
}

export function isTraceId(id: string): boolean {
  return /^tr_[0-9a-f]{12}$/.test(id)
}

export function newBranchId(): string {
  return `br_${randomBytes(6).toString("hex")}`
}

export function newTraceId(): string {
  return `tr_${randomBytes(6).toString("hex")}`
}
