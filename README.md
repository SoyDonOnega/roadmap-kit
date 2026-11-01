# roadmap-kit

A Claude Code plugin with two parts that share one Markdown roadmap:

- **`/roadmap`**: a pane beside the chat that shows the open tasks of your `Roadmap.md`, grouped by section. Click a task to read its description. Click the circle beside it to move it to **Done** with today's date.
- **`/close-session`**: at the end of a session, Claude lists what changed and what is left open. It then proposes what goes to the roadmap and what goes to memory. It writes only what you confirm.

The roadmap is a normal Markdown file. Keep it where you want: Google Drive, OneDrive, Dropbox, iCloud or a local folder.

## Install

The plugin has one option, **Roadmap file** (`roadmapPath`): the full path of your `Roadmap.md`. `~` is your home folder.

From a shell, give the path with the install:

```
claude plugin install roadmap-kit --marketplace SoyDonOnega/roadmap-kit --config roadmapPath=~/path/to/Roadmap.md
```

At the prompt of a terminal session:

```
/plugin install roadmap-kit --marketplace SoyDonOnega/roadmap-kit
```

In the desktop app: click + next to the prompt box, then Plugins. Add the marketplace `SoyDonOnega/roadmap-kit`, then add the plugin.

To set or change the path later, then restart Claude Code:

```
claude plugin configure roadmap-kit@roadmap-kit
```

No file yet? Copy [`examples/Roadmap.md`](examples/Roadmap.md) to the place you want. Or run `/close-session` once: it asks where to keep the roadmap and creates the file.

## The roadmap format

```
# Roadmap

## Next session

| # | Task | Description |
|---|---|---|
| 1 | Set up the roadmap pane | Install roadmap-kit and point roadmapPath at this file. |

## Done

| Date | Task |
|---|---|
| 2026-01-31 | #2 Weekly review |
```

This is the base:

- Each `##` heading is a section. The pane shows the sections in file order.
- Each section has one table. Each row is one task.
- `#` is the first column. It holds a number that is unique in the file.
- `Task` is the name of the task. `Description` is what it is, or its next step. The pane finds them by name (`Item` and `Next step` also work). Without these names, it uses the second column and the last column.
- `## Done` holds the finished tasks, newest first, as `| Date | #<n> <task> |`.
- A section with no table shows only its heading.

You can add columns, for example an owner, a date or an ID. The pane ignores them. `/close-session` keeps them and fills them when it knows the values.

## `/close-session`

Run it at the end of a session. Add an optional note: `/close-session focus on the API work`.

1. **Finds the roadmap.** It reads `roadmapPath`. If the option is not set, it asks where to keep the roadmap and saves the answer.
2. **Finds the memory.** It always uses Claude's own memory: the memory folder of the session and the `CLAUDE.md` files. The first time, it asks if you also keep memory in another place, for example a notes vault or a shared folder. It saves the answer as a memory fact, so it does not ask again.
3. **Gathers.** It reads the conversation, and for each repo it touched: changes not committed, commits not pushed, open pull requests.
4. **Reports.** It shows the changes, the open work, the roadmap changes (new tasks, tasks to Done) and the memory changes (save, update, remove).
5. **Applies** only the parts you confirm. Pending work goes to the roadmap. Lasting facts and preferences go to memory.

Claude replies in your language.

## Synced folders

On macOS, cloud folders are in `~/Library/CloudStorage/<Provider>-<account>/`. If the sync app is closed, a file you write there goes to a stale copy. The pane does not write the roadmap if it is in a Google Drive, OneDrive, Dropbox or Box folder and that app is not running. `/close-session` does the same check before it writes.

## What it reads and writes

- The pane reads `roadmapPath` every 30 seconds, and only when the file changed.
- The pane writes the file only when you click a circle.
- `/close-session` writes only what you confirm.
- No network access, except the `git` and `gh` commands of `/close-session`.

## Develop

```
claude plugin validate .
claude plugin test .
```

## License

MIT
