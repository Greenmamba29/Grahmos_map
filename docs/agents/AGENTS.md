# GrahmOS Multi-Agent Build Protocol

**Purpose:** how the GrahmOS continuity control plane gets built by a team of agents, and the hard constraints on which models may write code versus review it.

**Applies to:** all work under [`../GRAHMOS_EXECUTION_PLAN.md`](../GRAHMOS_EXECUTION_PLAN.md).

---

## 1. Non-negotiable constraints

### C1 — Fable 5 and Opus are review-only

`claude-fable-5-thinking-*` and `claude-opus-*` are **reviewers**. They MUST NOT author, edit, or refactor production source, schemas, or specifications.

| Allowed for Fable 5 / Opus | Not allowed |
|---|---|
| Reviewing diffs and leaving findings | Writing or editing source files |
| Auditing a spec against its acceptance tests | Authoring a spec |
| Adversarial review (threat modelling, "how does this lie to a user?") | Fixing what they found |
| Approving or blocking a gate | Committing anything |

When a reviewer finds a defect, it files a finding. **The implementing agent fixes it.** A reviewer that patches its own findings has reviewed nothing.

**How C1 is enforced.** A constraint enforced by nothing is a preference. Every PR carries an `Authored-by-model:` and `Reviewed-by-model:` trailer; gate G1 rejects a PR whose authoring trailer names a Fable 5 or Opus variant, and rejects one whose reviewing trailer is empty. This is an honest-agent mechanism, not a security control — it catches drift and mistakes, not a determined bypass. Say so rather than implying stronger enforcement than exists.

### C2 — Open source only, and verified

Every third-party dependency MUST be an open-source project with a public source repository, and its license MUST be read from that repository — not inferred from a badge, a package registry field, or memory. Verified inventory: [`../upstream/OPEN_SOURCE_REGISTRY.md`](../upstream/OPEN_SOURCE_REGISTRY.md).

GitHub is the default host, not a requirement; GitLab, Codeberg, and self-hosted forges are acceptable if the repository and its license file are publicly readable.

Adding a dependency requires, in the same change: repository URL, license quoted from the file, maintenance signal, and the capability or build stage it serves. No exceptions for transitive-only additions that end up in a bundle.

**Known state: the inventory is incomplete.** Section 3.3 of the registry lists what is still missing. C2 is the standard; the registry does not yet meet it, and it should not be cited as a clearance. Its first version missed OpenStreetMap's ODbL — the licence binding the artefact the product actually sells — which is the argument for generating the inventory from an SBOM rather than maintaining it by hand.

### C3 — No new major subsystem

Per the architecture memo's standing position. Adding a large subsystem (an orchestrator, a database engine, a message bus, a chaos platform) requires an explicit written justification reviewed under C1, naming what capability is unreachable without it.

### C4 — Documents are not evidence of code

"Done" means a named acceptance test ID passes. A markdown file claiming completion is a specification, not a status. This constraint exists because it has already failed once in this codebase: `PACK_VERIFICATION_HARDENING.md` describes a complete verification pipeline whose source files do not exist on the default branch.

---

## 2. Agent roster

Each agent owns an epic or a cross-cutting concern. One owner per artefact; shared ownership of a schema produces a schema with no consumers.

| Agent | Owns | Authoring model | Reviewed by |
|---|---|---|---|
| **spec-owner** | Bundle schema, capability vocabulary, media types, conformance corpus (Epic 1) | `composer-2.5` or `gpt-5.6-sol-high` | `claude-opus-5-thinking-high` |
| **runtime-eng** | `grahm` CLI, resolver, planner, apply backends, probes (Epic 2) | `gpt-5.6-sol-high` | `claude-opus-5-thinking-high` |
| **integration-eng** | Adapters for Eden / Valhalla / tiles / search, monorepo consolidation (Epic 3) | `composer-2.5` | `claude-fable-5-thinking-high` |
| **data-eng** | OSM → tiles → routing tiles → search index pipeline; dataset provenance (Epic 3) | `composer-2.5` | `claude-fable-5-thinking-high` |
| **truth-eng** | Facility Truth kernel, lifecycle, TTL policy, offline credentials (Epic 4) | `gpt-5.6-sol-xhigh` | `claude-opus-5-thinking-high` **and** `claude-fable-5-thinking-xhigh` (dual review — safety-critical) |
| **qual-eng** | Chaos harness, test matrix, rubric, report schema (Epic 5) | `gpt-5.6-sol-high` | `claude-opus-5-thinking-high` |
| **reviewer-correctness** | Diff review: correctness, determinism, error handling | — | *is* a reviewer |
| **reviewer-adversarial** | Threat modelling; "how does this present stale data as fresh?" | — | *is* a reviewer |

Models are stated as defaults, not doctrine. What is doctrine is C1: whichever model authors, **Fable 5 and Opus do not**.

---

## 3. Review gates

No change reaches the default branch without passing its gate. Gates are cumulative — a later gate does not excuse an earlier one.

| Gate | Trigger | Reviewer | Blocks on |
|---|---|---|---|
| **G0 — Contract** | Any change to a schema, capability id, media type, or error code | `reviewer-correctness` + spec-owner | An identifier with no named consumer; a capability with no functional probe |
| **G1 — Correctness** | Any source change | `reviewer-correctness` | Nondeterminism; unhandled error paths; digest computed over reparsed objects |
| **G2 — Adversarial** | Any change touching facility data, credentials, answers, or receipts | `reviewer-adversarial` | Any path where stale, unverified, or unattributed data can reach a user without a receipt |
| **G3 — Continuity** | Any change to runtime, bundle, or a service | `qual-eng` harness (automated) | Q-tier failure; severance not proven by packet counter |
| **G4 — Supply chain** | Any dependency addition or version bump | `reviewer-correctness` | Unverified license; unpinned reference; C2 violation |

**G2 is the gate that matters most**, and it is deliberately adversarial rather than checklist-driven. Its single question: *can this change cause GrahmOS to state something it cannot verify?* The reviewer's job is to find the path, not to confirm its absence.

**G2 does not stop at the receipt.** A receipt that correctly reports `breached: true`, rendered in small grey text beneath a large confident route line, satisfies "a receipt was attached" and realises risk R1 anyway. G2 therefore also blocks on presentation: any change to a client surface must be reviewed against the rendering contract, and "the data layer is honest" is not a defence when the pixels are not.

### The gates have been exercised once

This repository's plan and specification were themselves put through G1 and G2 before the first PR. The review found that the schema rejected 3 of 11 fixture classes its own prose required, that the qualification rubric could be satisfied by appending a timestamp to every answer, that a bundle could select the tests it was graded on, and that the license inventory had missed the licence governing the shipped datasets. All were fixed by the implementing agent, not the reviewer.

That is recorded here as calibration: a review of a document this size found roughly a dozen defects that would each have survived into implementation. A gate that finds nothing has not passed — it has failed quietly.

---

## 4. Working protocol

1. **Contract before implementation.** An adapter is written against a published capability contract, never against an engine's internals. Contract tests run against a stub provider *and* the real one — if only the real one passes, the contract is a description of the implementation, not a contract.
2. **Fixtures before linters.** The conformance corpus precedes the validator. A validator written first encodes its own bugs as reference behaviour.
3. **Harness before features.** The chaos harness (Epic 5) exists before the services it will sever. Retrofitting offline behaviour costs far more than requiring it.
4. **One commit per logical change**, with the acceptance test ID it satisfies in the message. A commit that satisfies no test ID needs a reason in the body.
5. **Refusals are deliverables.** When an agent cannot satisfy a requirement, it emits an explicit refusal with a reason — in the plan, in the receipt, in the PR. Silent partial success is the failure mode this whole product exists to eliminate, and it applies to the build process too.

---

## 5. Escalation

| Situation | Action |
|---|---|
| Reviewer and implementer deadlock on a contract | spec-owner decides; decision recorded in the spec with rationale |
| A dependency's license cannot be verified | Blocked. Do not proceed on assumption |
| An acceptance test is flaky | Quarantine, file a defect. A flaky test is a bug in the test or the system, never an accepted condition |
| A memo/plan assumption is contradicted by evidence | Stop, record the contradiction, revise the plan. Do not build to a premise that has been falsified |

The last row has already been exercised: the architecture memo asserts the capability engines are integrated; the repository survey found no reference to any of them. That contradiction is recorded in §0.3 of the execution plan rather than built around.
