# TEST.md — local loop

## Setup (portable Node in `.tools/`)

```powershell
.\node.cmd -v
.\npm.cmd test
.\serve.ps1
```

Open http://127.0.0.1:8765/demos/

## Now

1. `npm test` — L0 parse + L1 layout + kinds/themes
2. Visual: demos gallery + VISUAL.md scorecard
3. Expand demo: click headers / ArrowRight story

## Later

- L3 Playwright story/hover
- L4 screenshot goldens
- L4b vision scorecard before locking goldens
- GitHub push + CI