# Marketing Execution Board (V1)

## Scope

This board translates the strategy into build tasks across backend, frontend, content, and operations.

## Working Defaults

- Trial: 14 days.
- Grace after trial: 5 days.
- Hard lock after grace if unpaid.
- Gross margin target: 80%.
- Billing cycles: monthly + yearly (20% yearly discount).
- Language launch order: FR -> AR -> EN.
- Callback SLA after signup: within 24 hours.

## Milestones

### M1: Lifecycle + Billing Foundation (Week 1-2)

- Deliver trial, grace, lock states.
- Deliver manual payment proof flow + activation workflow.
- Deliver notifications for trial and limits.

### M2: Landing + Pricing + Conversion (Week 3-4)

- Deliver first-route landing page with 8 sections.
- Deliver pricing cards + monthly/yearly toggle.
- Deliver signup and assisted-contact CTAs.

### M3: Education + Analytics (Week 5-6)

- Deliver page help banners with short videos.
- Deliver event tracking for funnel conversion.
- Deliver initial optimization loops.

## Ticket Backlog

Legend:
- Priority: P0 (must), P1 (should), P2 (nice to have)
- Size: S (1-2d), M (3-5d), L (6d+)

### Track A: Account Lifecycle and Access Control

- [ ] P0 BE-001 (M) Add account lifecycle model and status transitions.
Acceptance: states `trial_active`, `trial_expired`, `grace`, `locked`, `active_paid`, timestamps and reason fields persisted.

- [ ] P0 BE-002 (M) Add server guard for status-based permissions.
Acceptance: locked users cannot create/update/send; read-only scope allowed per policy.

- [ ] P0 BE-003 (S) Add warning thresholds for usage limits.
Acceptance: threshold events at 70%, 90%, 100% emitted and stored.

- [ ] P0 FE-001 (M) Add global account status banner system.
Acceptance: clear banners for trial left, grace left, limit reached, locked.

- [ ] P0 FE-002 (S) Add lock-state screens and CTA to payment/assist flow.
Acceptance: locked state blocks actions and routes user to recovery flow.

- [ ] P1 QA-001 (S) Add lifecycle scenario tests.
Acceptance: trial to grace to lock and paid reactivation paths validated.

### Track B: Manual Payment and Activation Operations

- [ ] P0 BE-010 (M) Create payment proof entities and admin review actions.
Acceptance: proof upload metadata, review status, reviewer, decision timestamps.

- [ ] P0 FE-010 (M) Build payment proof submission UI.
Acceptance: user can submit transfer/Wafacash proof with required references.

- [ ] P0 FE-011 (S) Add account "awaiting activation" status UI.
Acceptance: user sees pending review message and SLA expectation.

- [ ] P0 OPS-010 (S) Create activation checklist SOP.
Acceptance: written process for proof validation and account activation steps.

- [ ] P1 OPS-011 (S) Create callback script and qualification form.
Acceptance: standard script captures user profile, needs, and plan recommendation.

### Track C: Pricing and Plan Catalog

- [ ] P0 PM-020 (S) Fill monthly cost sheet with real operating costs.
Acceptance: fixed + variable costs completed and validated.

- [ ] P0 BE-020 (M) Create plan catalog configuration.
Acceptance: Starter, Pro, Business with limits/features and billing cycles configurable.

- [ ] P0 FE-020 (M) Build pricing UI with monthly/yearly switch.
Acceptance: yearly toggle shows discounted values and "save" badge.

- [ ] P1 PM-021 (S) Compute price points at 80% gross margin target.
Acceptance: documented pricing output and sensitivity check for user-volume changes.

### Track D: Landing Page (Route `/`)

- [ ] P0 FE-030 (L) Build 8-section landing page structure.
Acceptance: sections include Hero, How-it-works, Preview, Benefits, Pricing, Assist, FAQ, Final CTA/Footer.

- [ ] P0 FE-031 (M) Add responsive layouts and mobile-first behavior.
Acceptance: no overflow issues, clear CTA visibility, high readability on small screens.

- [ ] P1 FE-032 (M) Add modern motion layer.
Acceptance: smooth entrance and scroll animations; no performance regressions.

- [ ] P2 FE-033 (M) Evaluate Three.js hero enhancement.
Acceptance: optional feature flag and fallback if low-performance devices detected.

- [ ] P0 CT-030 (M) Write first-copy in FR/AR/EN.
Acceptance: complete section copy and CTA copy in three languages.

### Track E: In-App Education

- [ ] P1 FE-040 (M) Add contextual help banners above key pages.
Acceptance: each key page supports a help banner with short explanation and video link.

- [ ] P1 CT-040 (M) Produce first batch of short tutorial videos.
Acceptance: at least one short video for each critical workflow page.

- [ ] P1 FE-041 (S) Add "Need assistance?" callback CTA in banners.
Acceptance: CTA opens assist request flow and stores request context.

### Track F: Analytics and KPI Tracking

- [ ] P0 BE-050 (M) Implement analytics event schema and ingestion.
Acceptance: events stored with user/account/session/time metadata.

- [ ] P0 FE-050 (M) Emit funnel events from UI.
Acceptance: events include `landing_view`, `signup_start`, `signup_complete`, `trial_start`, `first_document_created`, `payment_proof_submitted`, `account_activated`.

- [ ] P1 BI-050 (S) Build basic conversion dashboard.
Acceptance: view conversion rates by step and activation lead time.

## Dependency Order

1. Track A and Track B first.
2. Track C in parallel once cost sheet is filled.
3. Track D after pricing model is stable.
4. Track E and Track F immediately after first landing release.

## Definition of Done (Global)

- Feature is implemented and tested.
- i18n labels are added (FR/AR/EN where applicable).
- Responsive behavior verified on mobile and desktop.
- Tracking events validated for each conversion-critical action.
- Documentation updated in `/docs`.

## Immediate Next Actions

- Complete PM-020 with real monthly cost values.
- Start BE-001 and BE-010 in parallel.
- Start FE-001 and FE-010 after backend contracts are defined.
