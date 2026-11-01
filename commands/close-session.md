---
description: Close a work session — what changed, what is left open, what goes to the roadmap and to memory; applies only what you confirm
argument-hint: "[optional focus or note]"
disable-model-invocation: true
---

Close this session. Work only from this conversation and read-only checks; write nothing until the person confirms. Answer in the person's language, short. Optional note: $ARGUMENTS

## 1. Find the two stores

**Roadmap.** Run `claude plugin configure roadmap-kit --json` and take `roadmapPath` (a leading `~` is the home folder).

- Set and the file exists: use it.
- Unset, or no file there: ask where the person keeps their roadmap, or wants it. Suggest a synced folder so it is on every device, Google Drive first, but take any place they name (OneDrive, Dropbox, iCloud, a local folder). With their OK, create the file there from the base format below, and save the path with `printf '{"roadmapPath":"<path>"}' | claude plugin configure roadmap-kit --values-stdin`.

**Memory.** Claude's own memory always: the memory directory this session uses (with its `MEMORY.md` index) when there is one, and the `CLAUDE.md` files in play.

- Then look in that memory for a saved fact naming an extra memory store (a notes vault, a Drive or OneDrive folder, a wiki).
- None saved and not asked before: ask once whether they keep memory anywhere else. If they name one, add it here and offer to save its location as a memory fact, so the next close finds it without asking. If they say no, offer to save that answer too.

A store inside a synced folder (`~/Library/CloudStorage/<Provider>-…` on macOS, or the provider's own folder) is written only while its sync app runs; check before writing, and say so if it is closed.

## 2. Gather (read-only)

- From this conversation: files created or edited, repos touched, PRs opened or merged, configuration applied (settings, hooks, skills, plugins, scheduled tasks), decisions taken, things left half done or postponed.
- For each repo touched (and the current folder if it is a git repo): `git status --porcelain`, `git rev-list --count @{u}..HEAD`, and `gh pr list --author @me --state open` for that repo.
- Read the roadmap and the memory index (and the extra store's index, if any) to avoid duplicates.

## 3. Report

```
**Changes**
- <one line per meaningful change: what, where>

**Left open**
- <repo [branch]: N uncommitted, N unpushed, PR #N open> — or "Nothing"

**Roadmap**
- New: <task> (section, description)
- To Done: #<n> <task>
— or "Nothing"

**Memory**
- Save: <new preference or decision not written anywhere else> → <Claude memory | extra store | CLAUDE.md>
- Remove/update: <stale memory>
— or "Nothing"

**Apply?** roadmap · memory · commits/push (say which)
```

Write the headings in the person's language.

## 4. Apply (only what the person confirms)

- Roadmap: edit the file in place. A new task gets the next free number across the whole file, in the section it belongs to; a finished one leaves its section and goes to the top of the **Done** table with today's date. Keep any extra columns the person added.
- Memory: one fact per file in Claude's memory directory plus its line in `MEMORY.md`; a fact that belongs in the extra store goes there, in that store's own format. Stable rules go to the relevant `CLAUDE.md` instead.
- Commits and pushes: per repo, on a branch with a PR unless the person says otherwise; never force-push.

## Base roadmap format

```
# Roadmap

## <Section>

| # | Task | Description |
|---|---|---|
| 1 | <task> | <what it is, or its next step> |

## Done

| Date | Task |
|---|---|
| 2026-01-31 | #1 <task> |
```

`##` headings are sections, each with a table; `#` is a number unique across the file; **Done** is the last section, newest first. Columns the person adds (owner, date, ID…) stay and are filled when known.

## Rules

- Do not invent changes: list only what this conversation or the checks show.
- Pending work belongs in the roadmap, not in memory. Facts already in the stores or in git do not go to memory.
- Keep it to what matters; no step-by-step replay of the session.
