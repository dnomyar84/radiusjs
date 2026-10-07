# Agents

Radius is an open-source HTML5 diagramming system. Agents emit a `radius` fence (or JSON). The engine lays out and paints it. Product description: [README.md](README.md).

1. Read [RADIUS.md](RADIUS.md) at the same version as the script.
2. Emit ` ```radius ` (or JSON). No x/y, no raw CSS.
3. Pin script URL — never `@latest`.
4. On error, repair using `{ path, fix, see }`.

Visual taste gate: [VISUAL.md](VISUAL.md). Dev loop: [TEST.md](TEST.md).

```powershell
.\npm.cmd test
.\serve.ps1
```
