import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { BRANCH_FIELDS, type Branch } from "./branch"
import type { Trace } from "./trace"

export interface BranchStore {
  getBranch(id: string): Promise<Branch | null>
  putBranch(branch: Branch): Promise<void>
  listBranches(gameId?: string): Promise<Branch[]>
  getTrace(id: string): Promise<Trace | null>
  putTrace(trace: Trace): Promise<void>
  listTraces(): Promise<Trace[]>
  /** Write a branch and its trace in one step so a reader cannot see one without the other. */
  save(branch: Branch | null, trace: Trace): Promise<void>
}

export type StoreKind = "file" | "upstash"

export type SelectedStore = {
  readonly kind: StoreKind
  readonly store: BranchStore
  readonly warning: string | null
  readonly durable: boolean
}

type FileShape = { branches: Branch[]; traces: Trace[] }

function onlyBranch(branch: Branch): Branch {
  const patch = branch.patch ? { ...branch.patch } : null
  const next: Branch = {
    id: branch.id,
    parentId: branch.parentId,
    gameId: branch.gameId,
    ask: branch.ask,
    kind: branch.kind,
    patch,
    plan: branch.plan,
    authorId: branch.authorId,
    createdAt: branch.createdAt,
    status: branch.status,
    visibility: branch.visibility === "shared" || branch.visibility === "proposed" ? branch.visibility : "personal",
    traceId: branch.traceId,
  }
  for (const key of Object.keys(next)) {
    if (!BRANCH_FIELDS.includes(key as (typeof BRANCH_FIELDS)[number])) {
      delete (next as Record<string, unknown>)[key]
    }
  }
  return next
}

function onlyTrace(trace: Trace): Trace {
  return {
    id: trace.id,
    branchId: trace.branchId,
    gameId: trace.gameId,
    ask: trace.ask,
    route: trace.route,
    confidence: trace.confidence,
    plan: trace.plan,
    diff: trace.diff ? { ...trace.diff } : null,
    checks: Array.isArray(trace.checks) ? [...trace.checks] : [],
    evidence: trace.evidence ?? null,
    verdict: trace.verdict,
    decision: trace.decision,
    createdAt: trace.createdAt,
  }
}

function sortByTime<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || 0)
}

export function createMemoryStore(seed?: FileShape): BranchStore {
  const data: FileShape = {
    branches: seed ? seed.branches.map(onlyBranch) : [],
    traces: seed ? seed.traces.map(onlyTrace) : [],
  }
  return {
    async getBranch(id) {
      return data.branches.find((item) => item.id === id) ?? null
    },
    async putBranch(branch) {
      const next = onlyBranch(branch)
      const index = data.branches.findIndex((item) => item.id === next.id)
      if (index >= 0) data.branches[index] = next
      else data.branches.push(next)
    },
    async listBranches(gameId) {
      const items = gameId ? data.branches.filter((item) => item.gameId === gameId) : data.branches
      return sortByTime(items)
    },
    async getTrace(id) {
      return data.traces.find((item) => item.id === id) ?? null
    },
    async putTrace(trace) {
      const next = onlyTrace(trace)
      const index = data.traces.findIndex((item) => item.id === next.id)
      if (index >= 0) data.traces[index] = next
      else data.traces.push(next)
    },
    async listTraces() {
      return sortByTime(data.traces)
    },
    async save(branch, trace) {
      if (branch) await this.putBranch(branch)
      await this.putTrace(trace)
    },
  }
}

function queueFor(filePath: string) {
  let chain: Promise<unknown> = Promise.resolve()
  return async function locked<T>(fn: (data: FileShape) => Promise<T> | T): Promise<T> {
    const run = chain.then(async () => {
      const data = await readFileStore(filePath)
      const result = await fn(data)
      await writeFileStore(filePath, data)
      return result
    })
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

async function readFileStore(filePath: string): Promise<FileShape> {
  try {
    const text = await readFile(filePath, "utf8")
    const parsed = JSON.parse(text) as FileShape
    if (!parsed || !Array.isArray(parsed.branches) || !Array.isArray(parsed.traces)) {
      throw new Error(`branch file ${filePath} is not a branch store`)
    }
    return { branches: parsed.branches.map(onlyBranch), traces: parsed.traces.map(onlyTrace) }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") return { branches: [], traces: [] }
    throw error
  }
}

async function writeFileStore(filePath: string, data: FileShape): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(data, null, 2))
  await rename(temp, filePath)
}

export function createFileStore(filePath: string): BranchStore {
  const locked = queueFor(filePath)
  return {
    getBranch(id) {
      return locked((data) => data.branches.find((item) => item.id === id) ?? null)
    },
    putBranch(branch) {
      return locked((data) => {
        const next = onlyBranch(branch)
        const index = data.branches.findIndex((item) => item.id === next.id)
        if (index >= 0) data.branches[index] = next
        else data.branches.push(next)
      })
    },
    listBranches(gameId) {
      return locked((data) => {
        const items = gameId ? data.branches.filter((item) => item.gameId === gameId) : data.branches
        return sortByTime(items)
      })
    },
    getTrace(id) {
      return locked((data) => data.traces.find((item) => item.id === id) ?? null)
    },
    putTrace(trace) {
      return locked((data) => {
        const next = onlyTrace(trace)
        const index = data.traces.findIndex((item) => item.id === next.id)
        if (index >= 0) data.traces[index] = next
        else data.traces.push(next)
      })
    },
    listTraces() {
      return locked((data) => sortByTime(data.traces))
    },
    save(branch, trace) {
      return locked((data) => {
        if (branch) {
          const next = onlyBranch(branch)
          const index = data.branches.findIndex((item) => item.id === next.id)
          if (index >= 0) data.branches[index] = next
          else data.branches.push(next)
        }
        const nextTrace = onlyTrace(trace)
        const index = data.traces.findIndex((item) => item.id === nextTrace.id)
        if (index >= 0) data.traces[index] = nextTrace
        else data.traces.push(nextTrace)
      })
    },
  }
}

type RedisClient = {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<unknown>
  sadd(key: string, member: string): Promise<unknown>
  smembers(key: string): Promise<string[]>
}

let redisClient: RedisClient | null = null

async function redisFor(url: string, token: string): Promise<RedisClient> {
  if (redisClient) return redisClient
  const { Redis } = await import("@upstash/redis")
  redisClient = new Redis({ url, token })
  return redisClient
}

const branchKey = (id: string) => `liquid:branch:${id}`
const traceKey = (id: string) => `liquid:trace:${id}`
const branchSet = "liquid:branch-ids"
const traceSet = "liquid:trace-ids"

export function createUpstashStore(config: { url: string; token: string }): BranchStore {
  async function client() {
    return redisFor(config.url, config.token)
  }
  return {
    async getBranch(id) {
      const value = await (await client()).get<Branch>(branchKey(id))
      return value ? onlyBranch(value) : null
    },
    async putBranch(branch) {
      const next = onlyBranch(branch)
      const redis = await client()
      await redis.set(branchKey(next.id), next)
      await redis.sadd(branchSet, next.id)
    },
    async listBranches(gameId) {
      const redis = await client()
      const ids = await redis.smembers(branchSet)
      const items: Branch[] = []
      for (const id of ids) {
        const value = await redis.get<Branch>(branchKey(id))
        if (value) items.push(onlyBranch(value))
      }
      const filtered = gameId ? items.filter((item) => item.gameId === gameId) : items
      return sortByTime(filtered)
    },
    async getTrace(id) {
      const value = await (await client()).get<Trace>(traceKey(id))
      return value ? onlyTrace(value) : null
    },
    async putTrace(trace) {
      const next = onlyTrace(trace)
      const redis = await client()
      await redis.set(traceKey(next.id), next)
      await redis.sadd(traceSet, next.id)
    },
    async listTraces() {
      const redis = await client()
      const ids = await redis.smembers(traceSet)
      const items: Trace[] = []
      for (const id of ids) {
        const value = await redis.get<Trace>(traceKey(id))
        if (value) items.push(onlyTrace(value))
      }
      return sortByTime(items)
    },
    async save(branch, trace) {
      if (branch) await this.putBranch(branch)
      await this.putTrace(trace)
    },
  }
}

function fallbackWarning(env: NodeJS.ProcessEnv, filePath: string): string | null {
  if (env.VERCEL !== "1") return null
  const where = env.VERCEL_ENV === "production" ? "in production" : "on Vercel"
  return `UPSTASH_REDIS_REST_URL is missing ${where}. Branches are falling back to the file store at ${filePath}. That disk does not last. Provision Upstash Redis from the Vercel Marketplace and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.`
}

/** Upstash when both Marketplace env vars are set. Otherwise the file store, with a loud fallback on Vercel. */
export function selectStore(env: NodeJS.ProcessEnv = process.env): SelectedStore {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    return { kind: "upstash", store: createUpstashStore({ url, token }), warning: null, durable: true }
  }
  const onVercel = env.VERCEL === "1"
  const filePath = onVercel
    ? "/tmp/liquid-branches.json"
    : env.LIQUID_BRANCH_FILE || path.join(process.cwd(), "data", "branches.json")
  const warning = fallbackWarning(env, filePath)
  if (warning) console.error(`[liquid] ${warning}`)
  return { kind: "file", store: createFileStore(filePath), warning, durable: !onVercel }
}

let selected: SelectedStore | null = null

export function getStore(): SelectedStore {
  if (!selected) selected = selectStore()
  return selected
}
