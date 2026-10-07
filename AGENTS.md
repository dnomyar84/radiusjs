# Agents

1. Read [RADIUS.md](RADIUS.md) at the same version as the script.
2. Emit ` ```radius ` (or JSON). No x/y, no raw CSS.
3. Pin script URL — never `@latest`.
4. On error, repair using `{ path, fix, see }`.

Visual taste gate: [VISUAL.md](VISUAL.md). Dev loop: [TEST.md](TEST.md).

```powershell
.\npm.cmd test
.\serve.ps1
```

Cloud Agents: open `demos/index.html` (`#/playground`, `#/demo/<id>`). Do not start a static server. `serve.ps1` is the optional Windows preview only.
