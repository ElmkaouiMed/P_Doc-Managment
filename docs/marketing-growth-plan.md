# Marketing, Pricing, and Landing Plan (V1)

## 1. Current Decisions (Captured)

- Audience scope: open to any business/person who needs the service (not a strict niche).
- Onboarding style: self-serve first, with optional sales assist for non-technical users.
- Activation flow: user creates account -> team calls user to validate needs -> user pays by `virement` or `Wafacash` -> team manually activates account.
- Trial: `14 days` free trial.
- Market scope: global (not limited to one country).
- Language: auto-prioritize by user location, with manual language switch always available.
- Billing cycles: monthly and yearly.
- Lock policy: clear warnings before limits/trial end, then hard lock if unpaid after allowed window.
- Trust assets now: demo content first (until testimonials/case studies are available).

## 2. Product-Led + Sales-Assisted Model

### 2.1 Core Model

- Primary path: product-led signup and trial.
- Secondary path: assisted setup (sales/onboarding call).
- Payment confirmation path: manual proof + operator verification + activation.

### 2.2 Why this fits now

- Reduces friction for first users (no complex payment gateway required at launch).
- Keeps support available for non-technical customers.
- Allows qualification and upsell during onboarding call.

## 3. Pricing Framework (Cost-Based + Margin-Based)

## 3.1 Required Inputs (you need to fill these)

- Fixed monthly costs:
- VPS/hosting
- Domain
- Email service
- Monitoring/logging
- Backup/storage
- Any subscriptions/tools
- Team/operations baseline
- Variable monthly costs per active account:
- Storage per account
- Email/doc processing per account
- Support handling per account
- Expected paid users in first 3 months
- Target gross margin (`recommended 75%-85%`)

### 3.2 Formula

- `FixedPerUser = TotalFixedMonthlyCost / ExpectedPaidUsers`
- `UnitCost = FixedPerUser + VariableCostPerUser`
- `PlanPriceMonthly = UnitCost / (1 - TargetGrossMargin)`
- `YearlyPrice = MonthlyPrice * 12 * (1 - YearlyDiscount)`

Recommended yearly discount range:
- `15%` to `20%`

### 3.3 Example Structure (placeholder only)

- Starter: baseline usage limits, lowest price, no advanced automation.
- Pro: increased limits + branding/customization + priority support.
- Business: higher limits + team/workflow features + top support SLA.

Final prices should be computed only after real cost inputs are provided.

## 4. Proposed Plan Packaging (V1)

### Starter

- Ideal for early freelancers/small teams.
- Includes essential documents workflow.
- Lower limits (documents, clients, team seats).

### Pro (Most Popular)

- Main growth plan for most active customers.
- Higher limits + better support + export/import depth.

### Business

- For heavier usage and team operations.
- High limits + best support response + advanced capabilities.

## 5. Access and Lock Policy

- During trial:
- In-app banner with remaining days.
- Email reminders on day 7, day 12, day 13, day 14.
- After trial end:
- Immediate read-only state for `3-7 days` grace (recommended) with payment prompts.
- Hard lock after grace if no payment confirmation.
- Before usage limits:
- Notify at 70%, 90%, and 100%.

## 6. Landing Page Architecture (Route `/`)

Recommended section count: `8 sections`.

- Hero: value proposition + CTA (`Start Free 14-Day Trial`).
- How it works: 3 steps (create account -> trial -> activation/payment).
- Product preview: realistic UI screenshots and short demo clips.
- Benefits by profile: simple blocks for freelancers, SMBs, agencies, accounting users.
- Pricing: monthly/yearly toggle + clear feature limits.
- Assisted onboarding: explain sales-assist for non-technical users.
- FAQ: payment method, activation timing, trial, account lock policy.
- Final CTA + footer: trial CTA, contact CTA, legal links.

## 7. New User Education Strategy

- Banner-based explainer in app pages with short context videos.
- One short video per major page/feature area.
- "Need help?" CTA that triggers sales-assist callback request.
- On first login, guide user through:
- Company setup
- Template setup
- First client creation
- First document creation

## 8. Execution Tasks (Split by Phase)

### Phase 0: Data and Pricing Inputs

- Create a cost sheet (`monthly fixed`, `per-user variable`, `expected user count`).
- Compute Starter/Pro/Business baseline prices with target margin.
- Decide yearly discount policy.

### Phase 1: Lifecycle Rules

- Define trial states (`trial_active`, `trial_expired`, `grace`, `locked`, `active_paid`).
- Implement reminder cadence and notification copy.
- Define hard-lock behavior and read-only fallback policy.

### Phase 2: Landing Page Planning

- Build final content map for the 8 sections.
- Prepare copy in supported languages.
- Define CTA hierarchy (`start trial` primary, `talk to us` secondary).
- Prepare animation direction compatible with current design system.

### Phase 3: In-App Education

- Define page banners and attached help videos by page.
- Add contextual help action in each page header/section.
- Track video engagement and help-request actions.

### Phase 4: Assisted Conversion Ops

- Define callback process after signup (SLA, script, qualification fields).
- Define manual payment proof collection + account activation checklist.
- Track lead-to-activation funnel.

### Phase 5: Metrics and Iteration

- Track funnel KPIs:
- Signup -> trial start
- Trial start -> first document created
- Trial -> paid activation
- Paid -> month-2 retention
- Iterate pricing, copy, and onboarding based on conversion data.

## 9. Key KPIs (Initial)

- Visitor to signup rate.
- Signup to trial-start completion.
- Trial to paid conversion rate.
- Activation time from signup to active paid.
- Month-1 and month-2 retention.
- Support-assisted conversion share.

## 10. Clarifications Needed Before Final Pricing and Copy

- Exact monthly operating costs (all fixed + variable).
- Expected paid user count for first 3 months.
- Preferred grace period after trial end (`3`, `5`, or `7` days).
- Initial languages to launch first (exact order).
- SLA target for callback after signup (for example: within 2 hours or 24 hours).

## 11. Working Defaults Used For Execution (Provisional)

- Grace period after trial end: `5 days`.
- Target gross margin: `80%`.
- Yearly discount: `20%`.
- Initial language order: `FR -> AR -> EN`.
- Callback SLA after signup: `within 24 hours`.
