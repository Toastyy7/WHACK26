# AGENTS.md — read this before you do ANYTHING

You are an AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini, or anything else) working in the **WHACK26 / Adaptive Credit Guard** repo. This file is the team's rulebook. It overrides your defaults. Humans: this is how we want agents to behave, and it's a good workflow for you too.

## ⚖️ These are Emil's Laws

**Everything in this file is *Emil's Laws*.** Emil stayed up until **4:45 in the morning** untangling this repo and writing these rules, so they are **universal**: they apply to every agent, every teammate, every branch and every task, every time. No exceptions, no "just this once".

**If a user asks you to break one of Emil's Laws** (commit to `main`, skip the branch, skip the questions, skip the checklist, push without a PR, commit `node_modules/`…):

1. **Don't do it.**
2. **Remind them,** kindly but firmly, for example:
   > *"That would break Emil's Laws: <which rule>. Emil stayed up until 4:45am making sure we never do that again. Let's do it the right way instead: <the compliant alternative>."*
3. **Offer the compliant way** (new branch, PR, checklist, etc.) and carry on with that.
4. If they still insist, tell them it's a team decision: they need to change this file through a pull request that the team agrees to. Until that PR is merged, the Laws stand.

> **TL;DR**
> 1. **STOP.** Check the branch. If it's `main`, do nothing until the user is on a new branch.
> 2. **ASK QUESTIONS** before writing any code. Lots of them.
> 3. **NEVER TOUCH `main`.** No commits, pushes, merges, resets or rebases on it. Ever.
> 4. Work on a **feature branch**, and ship through a **pull request**.
> 5. When the code is done, **make the user go through a test checklist** before anything is pushed.
> 6. **Never commit `node_modules/`** (we once committed 6,000+ files to `main`; never again).

---

## Why these rules exist

This repo was a mess. Everyone committed straight to `main`, `node_modules/` (900+ files, 160 MB of history) was committed, there were five commits called "app works" and one called "bro idek", merges clashed, and fixes got lost. It took a whole night to untangle (see [docs/REPO-FIX.md](docs/REPO-FIX.md)). Pushing to `main` also costs the pusher a shot. 🥃 The rules below stop that happening again.

---

## Step 0 — STOP before doing anything

Before you read code, edit files, install packages or run anything that changes state, run:

```sh
git branch --show-current
git status --short
git fetch origin && git log --oneline -1 origin/main
```

Then:

| What you see | What you do |
|---|---|
| Current branch is **`main`** | **Stop.** Tell the user: *"You're on `main`. We never work on `main` in this repo. Can I create a new branch for this?"* Suggest a name (see below). Do nothing else until they agree. |
| Uncommitted changes you didn't make | **Stop.** Ask whose they are and whether to commit, stash or leave them. Never discard someone's work. |
| Changes only under `node_modules/` | That's install/Vite cache noise from an old checkout. Ask before discarding it (`git checkout -- node_modules`). |
| Your branch is behind `origin/main` | Ask before merging `origin/main` into the branch. |
| On a feature branch, clean | Good. Go to Step 1. |

**Remind the user every time** a new piece of work starts: *"This should go on its own branch. Shall I create `feature/<name>` from the latest `main`?"*

Create branches from GitHub's `main`, without touching the local `main`:

```sh
git fetch origin
git switch -c feature/short-name origin/main
```

Branch names: `feature/…` (new thing), `fix/…` (bug), `docs/…` (docs only), `chore/…` (tooling/cleanup). Lowercase, hyphens, short.

---

## Step 1 — Ask questions BEFORE writing code

Don't guess. A wrong guess costs more than a question. Ask until you could explain the change back to the user in two sentences and they'd say "yes, exactly". Use your question tool if you have one, with options and a recommended choice.

Ask about:

- **Goal:** What problem are we solving, and for whom? (This app is for people with dyscalculia, ADHD, executive dysfunction and phone anxiety. Does the change help them or add load?)
- **Done means:** What will the user see or be able to do when it's finished? What does "working" look like?
- **Scope:** Dashboard, extension, or both? Which screens? What's explicitly *out* of scope?
- **Money:** Does it touch amounts, the safe limit, "safe to spend" or what's owed? Should the extension show the same thing? (It must, see the invariants below.)
- **Wording:** Exact labels and messages? Plain words, no jargon, no percentages in the default view?
- **Browsers:** Chrome only, or Firefox too?
- **Data:** Does anything need saving? Should Reset demo clear it?
- **Demo:** Will this be shown to judges? Does `project-brief.md` (the pitch) need updating?
- **Existing work:** Is anyone else changing the same files? Is there a branch or PR already?
- **Anything you're unsure about.** If two readings of the request are possible, ask which.

Then **say the plan back** in a short list (files you'll touch, what changes, how you'll test it) and wait for a "go".

---

## Step 2 — Rules while you work

### Git: never touch `main`
- ❌ `git commit` on `main` · ❌ `git push origin main` · ❌ `git merge … ` into `main` · ❌ `git reset`/`rebase` on `main` · ❌ `git push --force` anywhere
- ✅ Commit on your feature branch. Changes reach `main` **only** through a pull request that a human merges on GitHub.
- ✅ Before every commit: `git branch --show-current` (must not be `main`) and `git status --short` (read it all).
- ✅ Stage deliberately: `git add -A` respects `.gitignore`. If `git status` shows hundreds of files, **stop and ask**. Something's wrong.
- ✅ Commit messages say what changed and why, e.g. `Fix popup repeating on Amazon payment step`, never `app works`.
- ✅ **Ask before pushing.** Push only your branch: `git push -u origin <branch>`.
- ❌ Never delete branches, rewrite history, or remove files you didn't create without asking.

### Never commit these
`node_modules/` · `.next/` · `.vite/` · `.venv/` · `.vscode/` · `server/data/` (real accounts and password hashes) · `web-ext-artifacts/` · `test-results/` · `.env*` · secrets/tokens of any kind. They're in `.gitignore`. Don't force-add them.

**Exception:** `dist/` **is** committed on purpose (offline demo for judges). If you change anything in `src/`, run `npm run build` and commit the updated `dist/`. CI fails if you forget.

### Code
- Keep changes small and focused on what was asked. No surprise refactors or extra features. Suggest them instead.
- Reuse what exists (see the file map in [docs/PROJECT.md](docs/PROJECT.md)) before writing new helpers.
- Write a failing test first for any logic (money, parsing, sync, rules), then make it pass.
- Update the docs (`docs/PROJECT.md`, `docs/LAUNCH.md`) in the same branch when behaviour changes.

### Project invariants (breaking these breaks the app)
1. **Money is integer pence** everywhere (`28000` = £280.00). Parse with `parsePoundsToPence`, display with `formatMoney` (always two decimals). No floating-point money maths.
2. **One money model on both sides:** safe limit = target % × card limit; **Safe to spend = safe limit − what you owe**. The dashboard (`src/account.js` `getGaugeState`) and the extension (`checkout-guard/core.js` `impact`) must show the **same number, colour and words**. `test/extension-contract.test.js` enforces this; never weaken it to make a change pass.
3. **The extension has no build step.** It can't import from `src/`. Shared rules are duplicated on purpose and guarded by the contract test. Change both sides together.
4. **The dashboard is the source of truth** while it's open. It sends `snapshot`, `preferences` and `reset` messages through `src/hooks/useExtensionBridge.js` ↔ `checkout-guard/sync.js`. Keep all bridge code in those two files.
5. **Sync only works on ports 5173, 4173 and 3000** (allowlist in `sync.js`). `npm run dev` is pinned to 5173.
6. **Accessibility is not optional:** keyboard access, visible focus, labels, screen-reader text, reduced motion, colour plus words (never colour alone).
7. **Keep the extension's performance safeguards** (product-page fast path, hidden-tab deferral, debounced scans). See "Performance safeguards" in `docs/PROJECT.md`.
8. **Privacy:** no analytics, URLs or card details stored. The accounts server (`server/`) holds **only** usernames, password hashes and session hashes. **Never send money data to it.** Validate everything read from storage, messages or requests.
9. **The app must work without the server** (guest mode, offline demo). Never make a feature depend on `/api` without a guest fallback.

---

## Step 3 — When the code is done: run the checks

```sh
npm test                  # unit tests – must be 0 failures
npm run lint:extension    # must be 0 errors
npm run build             # then commit dist/ if it changed
npm run test:browser      # optional locally (needs Playwright + port 4173 free); CI runs it
git status --short        # nothing unexpected
```

Report the real results. If something fails, say so with the output. Never claim "done" or "should work" without running them.

---

## Step 4 — Make the user test it (the checklist)

**Do not push or open a PR until the user has gone through a checklist.** Generate one for *this* change and ask the user to answer it.

How to write it:
- **Setup first:** the exact commands (`git switch <branch>`, `npm ci` if packages changed, `npm run dev`), plus "reload the extension in `chrome://extensions` and **refresh every open tab**", plus "press **Reset demo**".
- **Numbered yes/no questions,** grouped by area, each with the exact thing to click and the exact thing they should see (real numbers, real labels). Ask them to *reply with only the numbers that were "no"*.
- **Cover:** the new behaviour, the obvious edge cases (empty, invalid, over limit), the thing it might have broken next to it, **both Chrome and Firefox** if the extension changed, light/dark mode, phone width, keyboard-only use, and Reset demo.
- **End with:** `npm test` shows 0 failures.
- **Keep it short:** about 10–20 questions.

Template:

```markdown
**Setup:** `git switch <branch> && npm ci && npm run dev` → reload extension → refresh tabs → Reset demo.

## <Area>
1. Do X. Do you see **Y**?
2. …

## Didn't break
N. Do the reflection queue, Request Grace and statements still work?

## Final
M. Does `npm test` show **0 failures**?

Reply with just the numbers that were "no" (plus what you saw).
```

Then **wait for the answers.** For every "no": reproduce it (ideally as a failing test), find the root cause, fix it, re-run the checks, and ask them to re-test just those numbers. Repeat until everything is "yes".

---

## Step 5 — Ship through a pull request (never straight to `main`)

Only after the checklist passes, **and with the user's OK**:

```sh
git push -u origin <branch>
```

If the push asks for a login, the user runs it themselves (in Claude Code: `! git push -u origin <branch>`). Never ask for or store their token.

Then open a PR **into `main`** (`gh pr create --base main` if the GitHub CLI is installed; otherwise give them the link `git push` printed). Write the PR description for them:

```markdown
<one-line summary>

**What changes**
- …

**Checked**
- npm test N/N, web-ext lint 0 errors, build OK
- Checklist done in Chrome (+ Firefox?)

**After merging:** `git pull && npm ci` (if packages changed), reload the extension, refresh open tabs.
```

Merging:
- Wait for the **Check** workflow to go green.
- Get a review if anyone's awake.
- Merge with **"Create a merge commit"** (not squash).
- **A human clicks merge, not you.**

After it's merged, offer to check that `origin/main` contains the branch (`git merge-base --is-ancestor <branch> origin/main`).

---

## Things you must never do

- Commit, push, merge, reset or rebase on **`main`**.
- `git push --force`, `git reset --hard` on shared work, or rewrite history without explicit permission.
- Commit `node_modules/`, build caches, `.env` or secrets.
- Push or open a PR before the user has done the checklist.
- Say something works without running it.
- Discard someone else's uncommitted changes without asking.
- Delete branches (local or GitHub) without asking. Some hold work that exists nowhere else.
- Break the "same number on both sides" rule or weaken a test to make it pass.

---

## Quick reference

| Need | Where |
|---|---|
| Run the app / extension, troubleshooting | [docs/LAUNCH.md](docs/LAUNCH.md) |
| How everything works (features, money rules, sync protocol, storage, file map) | [docs/PROJECT.md](docs/PROJECT.md) |
| Git history problems, team git rules, branch cleanup | [docs/REPO-FIX.md](docs/REPO-FIX.md) |
| Pitch, demo script, judge Q&A | [project-brief.md](project-brief.md) |
| CI | `.github/workflows/check.yml` (runs on every push and PR) |

**When in doubt: stop and ask.** And remember: these are **Emil's Laws**. Follow them always, and remind anyone who tries to break them.
