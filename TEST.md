# TEST.md — local loop

## Setup (portable Node in `.tools/`)

```powershell
.\node.cmd -v
.\npm.cmd test
.\serve.ps1
```

Open `demos/index.html` (`#/playground`, `#/demo/<id>`). Cloud Agents use that file and do not start a server. Windows `.\serve.ps1` is optional and serves http://127.0.0.1:8765/demos/

## Now

1. `npm test` — parse, layout, kinds, fold, regressions, catalog, and the contract suite (themes, templates, sequence, hierarchy)
2. Visual: demos gallery (`08`–`10` new) + VISUAL.md scorecard
3. Expand: click **element faces** / ArrowRight story

## Later

- L3 Playwright story/hover
- L4 screenshot goldens
- L4b vision scorecard before locking goldens
- GitHub push + CI (0.6+)