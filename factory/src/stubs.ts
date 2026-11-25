/** TODO step 3: eve studio agents. Not called. */
export interface PlannerProducer {
  readonly step: 3
  readonly role: "planner-producer"
}

/** TODO step 3: eve studio agents. Not called. */
export interface LevelDesigner {
  readonly step: 3
  readonly role: "level-designer"
}

/** TODO step 3: eve studio agents. Not called. */
export interface BalanceTuner {
  readonly step: 3
  readonly role: "balance-tuner"
}

/** TODO step 3: eve studio agents. Not called. */
export interface LightArtAudio {
  readonly step: 3
  readonly role: "light-art-audio"
}

/** TODO step 5: propose-merge with owner accept and a qa gate. Not called. */
export interface QaPlayTester {
  readonly step: 5
  readonly role: "qa-play-tester"
}

/**
 * Owns the bible. `listInvariants` on the game contract is the listing hook.
 * Executable invariants are later. Not called.
 */
export interface ContinuityKeeper {
  readonly role: "continuity-keeper"
  readonly owns: "bible"
  readonly executable: false
}

/**
 * TODO step 3. A different model from the ask router. Not called.
 * The router model is `openai/gpt-5-mini`. This judge does not use it.
 */
export interface CdFitJudge {
  readonly step: 3
  readonly role: "cd-fit-judge"
  readonly separateModel: true
}

/** TODO step 6: @cursor/sdk runs for new mechanics. Not called. */
export interface Builder {
  readonly step: 6
  readonly role: "builder"
  readonly sdk: "@cursor/sdk"
}

/** TODO step 4: per-branch deploys. Not called. */
export interface BranchDeploys {
  readonly step: 4
  readonly role: "per-branch-deploys"
}

/** TODO step 5: propose-merge with owner accept and a qa gate. Not called. */
export interface ProposeMerge {
  readonly step: 5
  readonly role: "propose-merge"
}
