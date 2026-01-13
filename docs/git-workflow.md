# Lawexa - Git Workflow

## Branch Structure

```
main (production)
  │
  └── dev (integration)
        │
        └── phase-X (current work)
```

| Branch | Purpose | Merges Into |
|--------|---------|-------------|
| `main` | Production-ready, stable releases | - |
| `dev` | Integration branch, all completed phases | `main` |
| `phase-X` | Current phase work (e.g., `phase-2`) | `dev` |

---

## Branch Rules

### main
- Always deployable
- Only receives merges from `dev`
- Protected: no direct commits
- Represents stable releases

### dev
- Integration branch for completed phases
- Receives merges from `phase-X` branches
- Should always be in a working state
- Base for creating new phase branches

### phase-X
- Current development work
- Named after the phase: `phase-2`, `phase-3`, etc.
- Only one phase branch exists at a time
- Deleted after merging into `dev`

---

## Workflow

### Starting a New Phase

```bash
# Ensure dev is up to date
git checkout dev
git pull origin dev

# Create new phase branch
git checkout -b phase-2

# Push to remote
git push -u origin phase-2
```

### Daily Development

```bash
# Work on current phase
git checkout phase-2

# Make changes and commit
git add .
git commit -m "feat: add login form component"

# Push changes
git push origin phase-2
```

### Completing a Phase

When a phase is complete and tested:

```bash
# 1. Ensure phase branch is up to date
git checkout phase-2
git pull origin phase-2

# 2. Switch to dev and pull latest
git checkout dev
git pull origin dev

# 3. Merge phase into dev
git merge phase-2 --no-ff -m "Merge phase-2: Authentication"

# 4. Push dev
git push origin dev

# 5. Delete phase branch locally
git branch -d phase-2

# 6. Delete phase branch remotely
git push origin --delete phase-2

# 7. Create next phase branch
git checkout -b phase-3
git push -u origin phase-3
```

### Releasing to Production

When `dev` is stable and ready for production:

```bash
# 1. Ensure dev is up to date
git checkout dev
git pull origin dev

# 2. Switch to main
git checkout main
git pull origin main

# 3. Merge dev into main
git merge dev --no-ff -m "Release: Phase 2 - Authentication"

# 4. Tag the release (optional but recommended)
git tag -a v0.2.0 -m "Phase 2: Authentication complete"

# 5. Push main and tags
git push origin main
git push origin --tags
```

---

## Commit Message Convention

Use conventional commits for clarity:

```
type: short description

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring |
| `style` | Formatting, no code change |
| `docs` | Documentation |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
git commit -m "feat: add login form with validation"
git commit -m "fix: resolve 401 redirect loop on auth pages"
git commit -m "refactor: extract API error utility"
git commit -m "docs: update phase-2 implementation plan"
git commit -m "chore: install shadcn/ui components"
```

---

## Phase Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│   │ phase-2  │ ──► │   dev    │ ──► │   main   │           │
│   └──────────┘     └──────────┘     └──────────┘           │
│        │                                                    │
│        ▼                                                    │
│   [delete phase-2]                                          │
│        │                                                    │
│        ▼                                                    │
│   ┌──────────┐                                              │
│   │ phase-3  │ (created from dev)                          │
│   └──────────┘                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

### Check Current Branch
```bash
git branch
```

### Switch Branches
```bash
git checkout dev
git checkout phase-2
```

### View Branch History
```bash
git log --oneline --graph --all
```

### Sync with Remote
```bash
git fetch origin
git pull origin <branch-name>
```

---

## Phase Checklist

Before completing a phase, ensure:

- [ ] All tasks in phase plan are complete
- [ ] Code compiles without errors
- [ ] No TypeScript errors
- [ ] Manual testing passed
- [ ] Documentation updated if needed

---

## Current Project Status

| Phase | Status | Branch |
|-------|--------|--------|
| Phase 1: Setup | Complete | Merged to dev |
| Phase 2: Auth | In Progress | `phase-2` |
| Phase 3: Users | Pending | - |
| Phase 4: Courses | Pending | - |
| Phase 5: Cases | Pending | - |
| Phase 6: Notes | Pending | - |
| Phase 7: Bookmarks | Pending | - |
| Phase 8: Views & Limits | Pending | - |
| Phase 9: Subscriptions | Pending | - |

---

## Initial Setup

If starting fresh, set up the branch structure:

```bash
# You should already be on main with initial commit
git checkout main

# Create dev branch
git checkout -b dev
git push -u origin dev

# Create first phase branch
git checkout -b phase-2
git push -u origin phase-2
```
