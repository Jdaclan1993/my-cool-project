# CLAUDE.md — my-cool-project

## Tech Stack
- **Python 3.12** — core logic (root `.py` files)
- **Node 26 / TypeScript 5.3** — Next.js 14 dashboard (`dashboard/`)
- **React 18.2** — dashboard UI
- **Docker** — `docker-compose.yml` for services

## Essential Commands

### Python
```
pytest                         # run all tests
ruff check .                   # lint
mypy hello.py main.py tests/  # type check
make test                      # pytest (shortcut)
make lint                      # ruff (shortcut)
make typecheck                 # mypy (shortcut)
```

### Dashboard (Node)
```
cd dashboard
npm test           # jest
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run dev        # start dev server (port 3000)
npm run build      # production build
```

### Docker
```
docker compose up -d    # start services
docker compose down     # stop services
```

### Git
```
git push origin master  # push to remote
```

## Architecture Overview
- `hello.py` — Hello class with greet(name) method
- `main.py` — CLI entry point, imports Hello
- `utils.js` — greet() function (CommonJS), tested by dashboard/__tests__/
- `dashboard/` — Next.js 14 app router:
  - `src/app/api/` — 5 route groups: `calibrate/run`, `health/summary`, `live/{control,status}`, `paper/{control,status}`, `stats`
  - `src/components/LoginScreen.tsx` — auth UI
  - `src/lib/api.ts`, `state.ts` — shared utilities
  - `src/middleware.ts` — Next.js middleware
- `diagnostics/` — PolyMarket diagnostic scripts (standalone, not test suite)
- `docker-compose.yml` — multi-service orchestration
- `docs/` — project documentation

## Code Conventions
- Python: type hints on all function signatures, `__slots__` for small classes
- TypeScript: strict mode, explicit return types on API routes
- Node: CommonJS for root scripts, ESM for Next.js
- Commits: imperative mood, short subject lines (no Co-Authored-By)

## Do Not Touch Zones
Never modify without explicit user permission:
- `.claude/` — AI assistant config
- `CLAUDE.md` — this file
- `CHANGES.log` — auto-generated change log
- `diagnostics/` — PolyMarket scripts (read-only)
- `.aider*` — AI tool artifacts (gitignored, kept on disk)

## CI Pipeline
`.github/workflows/ci.yml` runs on every push/PR:
1. Python: pip install → ruff → mypy → pytest
2. Node: npm ci → tsc → eslint → jest

Remote: `https://github.com/Jdaclan1993/my-cool-project`
