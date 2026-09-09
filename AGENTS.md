# Celestium ERP — Agent Operational Rules & Workflow Directives

These guidelines are mandatory for all AI agents working within the Celestium ERP codebase.

## 1. Documentation-First Exploration
- **Always inspect `CelestiumERP.md` first** before searching or browsing across the wider codebase.
- `CelestiumERP.md` serves as the authoritative, comprehensive architectural catalog and feature specification for the platform.
- Only if the required information is not present or insufficient in `CelestiumERP.md` may the agent browse, search, or inspect other project files.

## 2. Post-Prompt Git Commit & GitHub Publication
- At the conclusion of every prompt / task:
  1. Stage all modified, added, and deleted files (`git add -A`).
  2. Commit the changes with a clear, conventional commit message reflecting the work performed.
  3. Publish and push the commits to GitHub (`git push origin main` or the active working branch).

## 3. Continuous Documentation Synchronization & Deprecation Management
- After every prompt / task:
  1. Update `CelestiumERP.md` to reflect all newly implemented features, modules, endpoints, domain events, permissions, models, services, workflows, and frontend components.
  2. Delete / prune any functionalities, endpoints, models, or workflows from `CelestiumERP.md` that have been deprecated, replaced, or removed.
  3. Keep `CelestiumERP.md` continuously accurate and synchronized as the single source of truth.
