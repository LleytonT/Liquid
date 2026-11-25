export type TraceView = {
  id: string
  route: string
  confidence: number
  summary: string
  diff: Record<string, number> | null
  checks: readonly unknown[]
  evidence: unknown
  verdict: string | null
  decision: string
}

function diffLine(diff: Record<string, number> | null): string {
  if (!diff || Object.keys(diff).length === 0) return "none"
  return Object.entries(diff)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ")
}

export function TraceStrip({ trace }: { trace: TraceView }) {
  const evidence = trace.evidence === null || trace.evidence === undefined ? "none" : JSON.stringify(trace.evidence)
  return (
    <section data-trace={trace.id} className="grid gap-0.5 px-4 py-2 text-[13px] leading-5">
      <p data-trace-route>
        route {trace.route} · confidence {trace.confidence.toFixed(2)} · {trace.decision}
      </p>
      <p data-trace-plan>{trace.summary}</p>
      <p data-trace-diff>diff {diffLine(trace.diff)}</p>
      <p data-trace-verdict>
        verdict {trace.verdict ?? "none"} · checks {trace.checks.length} · evidence {evidence}
      </p>
    </section>
  )
}
