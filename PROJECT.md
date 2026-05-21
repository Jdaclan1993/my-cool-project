# PROJECT.md – Current Project Snapshot

## What this project is
my-cool-project: multi-agent trading dashboard with calibration system.
Python + JavaScript/TypeScript. Tools: Claude Code + Aider. Git: active.

## Files
- main.py: entry point, parses CLI arg, calls hello.py
- hello.py: Hello class with __slots__, greet(name) method, type-hinted
- utils.js: Node.js greet function with JSDoc, input validation
- dashboard/: Next.js 14 trading dashboard with calibration system
- .gitignore, CHANGES.log present

## Most recent changes
- 2026-05-21: Optimized hello.py (__slots__), utils.js (JSDoc), dashboard page.tsx (memo, extracted constants)
- 2026-05-21: Built real calibration system (in-memory state store, live API routes, calibrate/run endpoint)
- 2026-05-21: Deduplicated AGENTS.md, calibrated agent thresholds, added simulate-trade flow
- 2026-05-11: Claude refactored hello.py, Aider refactored main.py

## Next actions
- Add unit tests for calibration engine
- Add export API route handler
- Consider persistent state storage

## How to update this file
At session end, say: Update PROJECT.md with today changes and what next.
