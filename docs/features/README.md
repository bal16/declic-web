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
defined once in [PRD-API](../PRD-API.md) §4.0 / §2 and [db-schema](../db-schema.md) — feature files
**reference, never redefine**. Endpoint bodies moved here from
[PRD-API](../PRD-API.md) §4.x (which keeps index pointers only, single source).

| Feature                                                                                   | Status                   | Owner modules                     |
| ----------------------------------------------------------------------------------------- | ------------------------ | --------------------------------- |
| [withdraw-work](./withdraw-work.md) — author retraction (`DELETE /api/posts/:id`)                           | specced, not implemented | `posts`                           |
| [series-upload](./series-upload.md) — upload, photographer edit (new `PATCH /api/posts/:id`), frame reorder | specced, not implemented | `posts`, `storage`, `queue`       |
| [curator-replace-revert](./curator-replace-revert.md) — Option C replace + single-level revert                       | specced, not implemented | `posts`, `queue`, `audit`         |
| [exhibition-lifecycle](./exhibition-lifecycle.md) — multi-exhibition, cron archive, freeze                         | specced, not implemented | `exhibitions`, `queue`, `audit`   |
| [gallery-discovery](./gallery-discovery.md) — public reads, lightbox, OG                                        | specced, not implemented | `posts`, `exhibitions`            |
| [engagement](./engagement.md) — likes + comments (flat v1)                                               | specced, not implemented | `engagement`                      |
| [curation-moderation](./curation-moderation.md) — reorder, approve/reject, comment hide, audit trail              | specced, not implemented | `curation`, `moderation`, `audit` |
| [feature-flags-site-settings](./feature-flags-site-settings.md) — kill-switches + global limits                           | specced, not implemented | `feature-flags`, `site-settings`  |
| [auth-rbac](./auth-rbac.md) — OAuth, guards, user list + role elevation (new)              | specced, not implemented | `auth`, `users`                   |

Conventions (see [Docs MOC](../README.md) for vault-wide rules): template is
Stories → API → FE → Worker → Schema touch → Edge cases → Out of scope
→ Acceptance checklist. New endpoints since 0.4-draft are marked
**(NEW for 1.0)** in their file: `PATCH /api/posts/:id`,
`PATCH /api/posts/:id/items/reorder`, `POST /api/posts/:id/retry`,
`GET /api/admin/users`,
`PATCH /api/admin/users/:id/role`,
`POST /api/admin/posts/:postId/frames/:itemId/replace`,
`POST /api/admin/posts/:postId/frames/:itemId/revert`,
`POST /api/admin/exhibitions/:id/poster-upload-url`.
