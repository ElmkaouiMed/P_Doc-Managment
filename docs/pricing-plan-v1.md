# Pricing Plan V1 (PM-020 Completed)

Date: 2026-03-17

## Input Snapshot

- Total fixed monthly costs: 4,080 MAD
- Variable cost per active account: 26 MAD
- Expected paid users (M1/M2/M3): 120 / 180 / 240
- Average expected paid users: 180
- Target gross margin: 80%
- Yearly discount: 20%

Source: `docs/pricing-cost-inputs-template.csv`

## Cost Model

- Fixed per user: `4,080 / 180 = 22.67 MAD`
- Unit cost per average paid user: `22.67 + 26 = 48.67 MAD`
- Reference floor price at 80% margin: `48.67 / (1 - 0.80) = 243.35 MAD`

## Final Plan Prices

- Starter:
  - Monthly: `169 MAD`
  - Yearly: `1620 MAD` (20% discount)
  - Positioning: low-volume users with base limits
- Pro:
  - Monthly: `269 MAD`
  - Yearly: `2580 MAD` (20% discount)
  - Positioning: main growth plan
- Business:
  - Monthly: `499 MAD`
  - Yearly: `4790 MAD` (20% discount)
  - Positioning: high-volume teams and advanced operations

## Margin Check (Quick)

- Starter remains viable for low-usage cohorts.
- Pro and Business create margin headroom to absorb support and onboarding load.
- Mix target recommendation:
  - Starter: 35%
  - Pro: 45%
  - Business: 20%

This mix keeps blended margin aligned with the 80% target while protecting onboarding costs in early growth.

