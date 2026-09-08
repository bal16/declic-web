---
aliases:
  - Features Index
tags:
  - declic
  - moc
  - feature
status: living
---

# Features — Index & Status (1.0 acceptance)

One file per feature, vertical slice (API + FE + worker + schema +
acceptance). Rule: contracts (cursor, errors, guards, schema) are
defined once in [[PRD-API]] §4.0 / §2 and [[db-schema]] — feature files
**reference, never redefine**. Endpoint bodies moved here from
[[PRD-API]] §4.x (which keeps index pointers only, single source).

| Feature | Status | Owner modules |
|---|---|---|
| [[withdraw-work]] — author retraction (`DELETE /api/posts/:id`) | specced, not implemented | `posts` |
| [[series-upload]] — upload, photographer edit (new `PATCH /api/posts/:id`), frame reorder | specced, not implemented | `posts`, `storage`, `queue` |
| [[curator-replace-revert]] — Option C replace + single-level revert | specced, not implemented | `posts`, `queue`, `audit` |
| [[exhibition-lifecycle]] — multi-exhibition, cron archive, freeze | specced, not implemented | `exhibitions`, `queue`, `audit` |
| [[gallery-discovery]] — public reads, lightbox, OG | specced, not implemented | `posts`, `exhibitions` |
| [[engagement]] — likes + comments (flat v1) | specced, not implemented | `engagement` |
| [[curation-moderation]] — reorder, approve/reject, comment hide, audit trail | specced, not implemented | `curation`, `moderation`, `audit` |
| [[feature-flags-site-settings]] — kill-switches + global limits | specced, not implemented | `feature-flags`, `site-settings` |
| [[auth-rbac]] — OAuth, guards, user list + role elevation (new) | specced, not implemented | `auth`, `users` |

Conventions (see [Docs MOC](../README.md) for vault-wide rules): template is
Stories → API → FE → Worker → Schema touch → Edge cases → Out of scope
→ Acceptance checklist. New endpoints since 0.4-draft are marked
**(NEW for 1.0)** in their file: `PATCH /api/posts/:id`,
`GET /api/admin/users`, `PATCH /api/admin/users/:id/role`.
