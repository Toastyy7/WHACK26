# Fixing the WHACK26 repo

What went wrong, what the `chore/review-refactor` branch already fixes, and the steps to get everyone onto a clean `main` safely. Nothing here needs anyone to push straight to `main`.

## What went wrong

| Problem | Effect |
|---|---|
| **No `.gitignore` early on**, so `node_modules/` (904 files) and an old Next.js `.next/` cache were committed. | Every `npm install` or dev-server start shows dozens of changed files. 163 MB of the repo's 198 MB history is `node_modules`. Commits like "bro idek" were only dependency changes. |
| **Everyone committed straight to `main`.** | Merges clashed, and fixes got lost or half-merged. PR #2 brought over Jamie's extension but not his cleanup or later fixes. |
| **Commit messages like "app works" ×5.** | Nobody can tell from history what changed or when something broke. |
| **Parallel versions of the app** (`jamieBranch` kept an older single-file dashboard). | Merging needed manual conflict resolution in 20+ files. |
| **CI only ran on `jamieBranch`.** | Nothing checked `main`, so its browser test silently broke. |
| **`dist/` committed but never checked.** | The offline demo can lag behind the source. |
| **Lots of leftover branches** (`BEST`, `fixing-app`, `new`, `web-extensions`, `jamieTest`, `jamieBranch` on GitHub, more locally). | Hard to tell what's live, merged or abandoned. Two local branches hold work that exists nowhere else. |

## Already fixed on `chore/review-refactor`

This branch is built on top of the latest `main` and includes `fix/extension-sync` and Jamie's `jamieBranch` cleanup:

- `.gitignore` covers `node_modules/`, `.next/`, `.vite/`, `.venv/`, `.vscode/`, build artifacts and `.env`. Those files are no longer tracked; they stay on disk.
- CI runs on **every branch and pull request**: unit tests, extension lint, build, a check that `dist/` is up to date, the full browser test and extension packaging.
- The browser test is rewritten for the current dashboard and now includes a real-extension sync test.
- Code fixes: extension ↔ dashboard sync, popup no longer repeats on multi-page checkouts, purchases increase the amount owed (so preview and reality agree), demo statement categories corrected, duplicated bridge code merged into one hook, and a contract test for the duplicated validators. See [PROJECT.md](PROJECT.md).

## Step 1 — Merge through a pull request (not a push to `main`)

```sh
git switch chore/review-refactor
git push -u origin chore/review-refactor
gh pr create --base main --title "Clean up repo, sync extension, docs" --body "See docs/REPO-FIX.md"
```

Or open the PR on GitHub from the link printed by `git push`.

- Wait for the **Check** workflow to go green.
- Get one teammate (ideally Jamie, since the extension is his) to review it.
- Merge with **"Create a merge commit"**. Don't squash: other branches share history with this one.
- Close the older `fix/extension-sync` PR if one was opened; this PR already contains it.

## Step 2 — Everyone updates once after the merge

Each teammate, in their own clone:

```sh
# 0. Save anything you haven't committed (skip if `git status` shows only node_modules)
git stash push -m "before cleanup" -- . ':!node_modules'

# 1. Throw away node_modules noise so git lets you switch
git checkout -- node_modules 2>/dev/null; git switch main

# 2. Get the new main
git pull --ff-only

# 3. Reinstall dependencies (git just stopped tracking them)
npm ci

# 4. Bring back saved work, if you stashed any
git stash pop
```

If `git pull --ff-only` refuses, you have commits on your local `main` that aren't on GitHub. Don't force anything. Move them to a branch and open a PR:

```sh
git switch -c my-leftover-work      # keeps your commits
git switch main && git reset --hard origin/main   # local main = GitHub main
```

Then reload the extension in `chrome://extensions`.

## Step 3 — Protect `main` on GitHub (owner: Toastyy7)

**Settings → Branches → Add branch protection rule** for `main`:

- ✅ Require a pull request before merging (1 approval)
- ✅ Require status checks to pass → select **check**
- ✅ Do not allow bypassing the above settings
- ❌ Allow force pushes

After this, nobody can push to `main` by accident, which also ends the shots 🥃.

## Step 4 — Back up, then tidy branches

**First, back up the two local-only branches.** They only exist on Emil's laptop:

| Branch | Not in `main` | Contents |
|---|---|---|
| `BEST` (local is 1 ahead of GitHub) | 4 commits | eBay checkout detection, wage-hours metric, cognitive checklist, statement due-date reminder |
| `balance-deduction` | 5 commits | Older "deduct on Proceed" idea, replaced by the sync work |

```sh
git push origin BEST:archive/best balance-deduction:archive/balance-deduction
```

**Then delete merged or abandoned branches**, after the PR is merged and the team agrees:

```sh
# GitHub
git push origin --delete fixing-app new web-extensions jamieTest jamieBranch BEST fix/extension-sync
# Local
git branch -D web-extension web-extensions jamie-into-main fix/extension-sync BEST balance-deduction
git fetch --prune
```

Anything deleted by mistake can be restored for a while from GitHub's branch list, and the `archive/` copies stay.

## Step 5 — Working rules from now on

1. **Never commit to `main`.** `git switch -c feature/short-name` → commit → push the branch → PR → green CI → review → merge.
2. **Pull before you start:** `git switch main && git pull --ff-only && git switch -c feature/…`.
3. **Say what changed** in commit messages: "Fix popup repeating on Amazon payment step", not "app works".
4. **Never `git add` dependencies or build caches.** Use `git add -A` (it respects `.gitignore`) and check `git status` before committing.
5. **Changed the dashboard? Rebuild and commit `dist/`:** `npm run build && git add dist`. CI fails otherwise.
6. **Changed the extension? Reload it** in `chrome://extensions` before testing.
7. **One feature per branch, small PRs.** Merge `main` into your branch if it gets behind.

## Optional — shrink the history (not during the hackathon)

The old `node_modules` commits keep the repo at about 54 MB packed. Rewriting history (`git filter-repo --path node_modules --invert-paths`) would shrink it, but it changes every commit ID: everyone must re-clone and all open PRs break. Only do it after judging, all at once, with everyone's work merged first.
