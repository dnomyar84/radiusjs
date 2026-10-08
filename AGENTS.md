# Agents

1. Read [RADIUS.md](RADIUS.md) at the same version as the script.
2. Emit ` ```radius ` (or JSON). No x/y, no raw CSS.
3. Pin script URL — never `@latest`.
4. On error, repair using `{ path, fix, see }`.

Visual taste gate: [VISUAL.md](VISUAL.md). Dev loop: [TEST.md](TEST.md).

You are the only code editor. After tests pass, merge your pull request into `main` (`gh pr merge <number> --repo dnomyar84/radiusjs --merge --delete-branch`). See [.cursor/rules/auto-merge.mdc](.cursor/rules/auto-merge.mdc).

```powershell
.\npm.cmd test
.\serve.ps1
```
