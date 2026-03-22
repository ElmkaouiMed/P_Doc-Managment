# Web Owner Project Plan

## Goal
Build a separate `web_owner` application (owner backoffice) on a dedicated subdomain, using the same database as `web_admin`, with stronger security controls and owner-focused pages.

## Phase 0 - Rollback in `web_admin` (Completed)
- Remove owner-only mode logic from auth/session and routing.
- Remove owner-specific dashboard component and owner-only navigation rules.
- Keep `web_admin` focused on customer workspace only.
- Validation:
  - `npm run lint` passed
  - `npm run build` passed

## Phase 1 - Architecture and Security Baseline
1. Define owner app boundaries.
   - Subdomain: `owner.<domain>`
   - Separate deployment/service from `web_admin`
   - Shared DB, separate secrets and runtime config
2. Define platform auth model.
   - Create `PlatformUser` and `PlatformRole` (not company membership roles)
   - Roles: `SUPER_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_AGENT`, `VIEWER`
3. Define mandatory security controls.
   - MFA (TOTP + backup codes)
   - Rate limiting and login lockout
   - Separate session cookie name and secret
   - CSRF protection for state-changing endpoints
   - Audit log for all critical actions
   - Strict security headers

## Phase 2 - Data Model and Migrations
1. Add platform auth tables.
   - `PlatformUser`
   - `PlatformSession`
   - `PlatformMfaSecret`
   - `PlatformAuditLog`
2. Add owner-domain tables.
   - `Reclamation` (ticket)
   - `ReclamationMessage` / assignment fields
   - `PlanDefinition`
   - `PlanLimit`
   - `CompanySubscription` / plan linkage
3. Add indexes and constraints for owner operations.
4. Create migration + seed for first super admin.

## Phase 3 - Bootstrap `web_owner` App
1. Create new Next.js app `web_owner`.
2. Reuse design tokens/components from `web_admin` for visual consistency.
3. Build core shell.
   - Sidebar
   - Header
   - Notifications area
   - Protected layout + role guard
4. Implement owner auth flow.
   - Sign-in
   - MFA verify
   - Sign-out
   - Session management

## Phase 4 - Owner Pages (Implementation Order)
1. Accounts
   - Company lifecycle/status
   - Activation queue
   - Lock/unlock actions
   - Trial/grace visibility
2. Payments
   - Payment proof queue
   - Approve/reject/review workflows
   - Reconciliation view
3. Notifications
   - Delivery logs
   - Failed notification retry controls
4. Reclamations
   - Ticket list and details
   - Assignment and status flow
   - SLA indicators
5. Plans Settings
   - Plan CRUD
   - Limits/features matrix
   - Price and billing cycle controls

## Phase 5 - Hardening and Readiness
1. Security tests.
   - RBAC authorization tests
   - MFA enforcement tests
   - Audit log integrity checks
2. Operational readiness.
   - Monitoring/alerting
   - Backup and restore checks
   - Error reporting and incident hooks
3. UAT and release checklist.
   - Critical flows smoke tests
   - Admin onboarding guide
   - Production rollout plan

## Execution Notes
- `web_admin` and `web_owner` share DB models but must remain UI/logic isolated.
- No owner-only controls should remain in customer-facing `web_admin`.
- All owner write actions must emit audit events.
