# Claude Code Session Management Cheat Sheet

## Verified Commands (source: /help + official docs)

### Context Management
| Trigger | Command | Effect |
|---------|---------|--------|
| Context bloated, drifting, or stuck | `/clear` | Full wipe — starts empty session. Old session saved, resumable via `/resume` |
| Context filling up but need continuity | `/compact [focus]` | Compresses history into summary. Keeps key decisions, drops noise. NOT a full wipe |
| Claude made wrong change, need undo | `/rewind` | Rolls back to earlier checkpoint. Also `/undo`, `/checkpoint` |
| Quick question, don't pollute context | `/btw <question>` | Answered in isolation. Zero impact on main conversation context |
| Fork conversation at this point | `/branch [name]` | Preserves original, creates parallel branch. Also `/fork` |
| Switch to saved session | `/resume [id\|name]` | Opens session picker or loads by ID. Also `/continue` |

### Token & Cost Visibility
| Trigger | Command | Effect |
|---------|---------|--------|
| See token usage and cost | `/usage` | Shows session cost, plan limits, activity stats. Aliases: `/cost`, `/stats` |
| Visual context map | `/context [all]` | Colored grid of context usage with optimization tips |

### Model & Effort Control
| Trigger | Command | Effect |
|---------|---------|--------|
| Switch model mid-session | `/model sonnet` | Immediate model change (sonnet/opus/haiku or full IDs) |
| Reduce/increase reasoning | `/effort low\|medium\|high\|xhigh` | Controls extended thinking budget. `max` is session-only |
| Toggle fast output mode | `/fast on\|off` | Faster token generation (no model downgrade) |

### Session Persistence
| Trigger | Command | Effect |
|---------|---------|--------|
| Keep working across turns | `/goal <condition>` | Claude won't stop until condition met. `/goal clear` to cancel |
| Run in background | `/background [prompt]` | Detaches session. Also `/bg` |
| List background tasks | `/tasks` | Shows running background agents and shells |

### Config & Diagnostics
| Trigger | Command | Effect |
|---------|---------|--------|
| Change any setting | `/config` | Opens settings UI (model, theme, permissions, hooks, env vars) |
| Diagnose issues | `/doctor` | Verifies installation, connectivity, settings |
| Manage permissions | `/permissions` | Allow/ask/deny rules for tools. Also `/allowed-tools` |
| Analyze sessions | `/insights` | Report on your usage patterns across sessions |
| Edit memory files | `/memory` | Manage auto-memory and CLAUDE.md entries |

### Code Review & Quality
| Trigger | Command | Effect |
|---------|---------|--------|
| Review a PR | `/review <PR>` | Local PR review |
| Security audit | `/security-review` | Security analysis of branch changes |
| Verify change works | `/verify` | Build, run, and observe a change |
| Deep cloud review | `/ultrareview <PR>` | Multi-agent review in cloud sandbox |
| Parallel refactor | `/batch <instruction>` | 5-30 worktree agents in parallel, each gets a PR |

### Planning
| Trigger | Command | Effect |
|---------|---------|--------|
| Plan before coding | `/plan [description]` | Enter plan mode — design first, get approval, then implement |
| Cloud-scale plan | `/ultraplan <prompt>` | Draft plan, review in browser, execute remotely |

### Miscellaneous
| Trigger | Command | Effect |
|---------|---------|--------|
| Show all commands | `/help` | Full command list |
| List skills | `/skills` | Available skills with descriptions |
| Export conversation | `/export [filename]` | Plain text export |
| Copy last response | `/copy [N]` | Copy assistant response to clipboard |
| Interactive diff | `/diff` | Per-turn diff viewer |
| Rename session | `/rename [name]` | Names current session for easy `/resume` |

---

## Session Lifecycle

```
New task (unrelated) → /clear (fresh context, no baggage)
New task (related)   → keep going or /compact to free space
Claude off-track     → /rewind (rolls back to last good checkpoint)
Context getting full → /context (diagnose), then /compact
Need token count     → /usage (or /cost, /stats)
Big subsystem change → /plan (design first, don't just code)
Verify a fix         → /verify (build + run + observe)
Review before merge  → /review or /security-review
Long-running work    → /goal to keep Claude working across turns
```

**Ideal pattern for a work session:**
1. Start with `/clear` or `/resume` appropriate session
2. `/plan` for any non-trivial change
3. `/goal` if the task spans multiple turns
4. `/compact` when responses slow down or get repetitive
5. `/usage` periodically to monitor token burn
6. `/clear` when switching to a completely different feature/area

---

## When to Reset (30-60 Minute Rule)

**Honest assessment:** The 30-60 minute rule is not an official Anthropic recommendation, but it reflects a real phenomenon. Context accumulates rapidly — tool outputs, diffs, file contents, and conversation history all fill the window. After 500K-800K tokens, Claude can become less precise, repeat itself, or fixate on earlier context at the expense of new instructions.

**I agree partial resets help.** Full `/clear` every 30-60 minutes is too aggressive — you lose all accumulated project understanding. Better approach: **strategic compaction + goal-based continuity.**

### Signs you need a reset:
- Claude repeats the same suggestion or fix multiple times
- Claude references files or decisions from 10+ turns ago that are no longer relevant
- Responses get noticeably slower (compaction hasn't triggered yet)
- `/usage` shows 700K+ tokens consumed
- Claude misunderstands new instructions because old context dominates
- Tool call errors increase (file not found for files you renamed hours ago)

### Reset prompt template:
```
Summarize in 5 bullet points: (1) what we accomplished, (2) what's still in progress,
(3) key decisions made, (4) files changed, (5) what to do next. Then /clear.
```
After `/clear`, paste the summary so the new session has exactly the context it needs — no more, no less.

### Alternative to full reset:
- `/compact` with a focus instruction: `/compact Keep: current CLAUDE.md structure, settings.json model change, and the SESSION_RULES.md we're writing. Drop: all git status chatter from earlier.`
- This is better than `/clear` when you're mid-task and want to keep momentum.

---

## Research Notes

### /config findings for unverified settings:
- **`MAX_THINKING_TOKENS`** — Confirmed as an **env var** (not a settings.json key). Set via `env.MAX_THINKING_TOKENS` in settings.json or as a shell env var. On models with adaptive reasoning (Opus 4.7), this has limited effect — use `/effort` instead.
- **Subagent model** — Confirmed key: `CLAUDE_CODE_SUBAGENT_MODEL` (env var, not settings.json key). Sets model for ALL subagents. Individual per-agent models exist but are configured via `~/.claude.json`, not settings.json.
- **Compaction** — No dedicated settings key exists. Compaction is fully automatic. The closest controls are `skillListingBudgetFraction` and `maxSkillDescriptionChars` (for skill listing budget, not compaction itself).

### Key env vars worth adding to settings.json:
```json
{
  "model": "sonnet",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku"
  }
}
```
This runs the main thread on Sonnet and subagents on Haiku — additional token savings.

### Expected commands NOT found: None. All commands I recalled (/plan, /rewind, /clear, /compact, /usage) are confirmed in /help output.

---

## Parallel Worktrees

### Creation Commands
```powershell
git -C "C:\Users\julius daclan jr\Documents\my-cool-project" worktree add "C:\Users\julius daclan jr\Documents\my-cool-project-feature" -b feature/new-feature

git -C "C:\Users\julius daclan jr\Documents\my-cool-project" worktree add "C:\Users\julius daclan jr\Documents\my-cool-project-bugfix" -b bugfix/hotfix

git -C "C:\Users\julius daclan jr\Documents\my-cool-project" worktree add "C:\Users\julius daclan jr\Documents\my-cool-project-review" -b review/exploration
```

### Environment Setup (first time per worktree)
```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd dashboard && npm ci
```

### Launching Claude Code
```powershell
cd "C:\Users\julius daclan jr\Documents\my-cool-project-feature" && claude
cd "C:\Users\julius daclan jr\Documents\my-cool-project-bugfix" && claude
cd "C:\Users\julius daclan jr\Documents\my-cool-project-review" && claude
```

### Daily Workflow
| Worktree | Branch | Purpose | Terminal |
|----------|--------|---------|----------|
| `my-cool-project` | `master` | Ongoing work, commits, pushes | Tab 1 (main) |
| `my-cool-project-feature` | `feature/new-feature` | New feature branch, multi-commit work | Tab 2 |
| `my-cool-project-bugfix` | `bugfix/hotfix` | Hotfix, fast turnaround | Tab 3 |
| `my-cool-project-review` | `review/exploration` | PR review, experimentation, throwaway | Tab 4 |

Each worktree runs in its own terminal tab. Color-code tabs or label them to avoid confusion.

### Cleanup
```powershell
git worktree remove "C:\Users\julius daclan jr\Documents\my-cool-project-feature"
git branch -d feature/new-feature   # only if fully merged
```

### Shared Resource Warning
`.venv/` and `node_modules/` are gitignored and must be recreated in each new worktree. See Environment Setup above. Each worktree gets its own copy — no sharing between worktrees.

---

## Plan Mode → Execute

[VERIFIED: 2026-05-22 — tested live in this session]

### Confirmation
`/plan` is CONFIRMED in Claude Code CLI. Command: `/plan [description]`. Also triggerable by Claude via the `EnterPlanMode` tool when a task is non-trivial.

### Exact Command
```
/plan Add a docstring to hello.py
```

### What Plan Mode Can/Cannot Do (Observed)

| Capability | Allowed? |
|------------|----------|
| Read files (Glob, Grep, Read) | YES |
| Launch Explore/Plan agents | YES |
| Write to plan file | YES (only file) |
| Edit/Write project files | NO |
| Run non-readonly Bash/PowerShell | NO |
| Git commits | NO |

### Approval Flow
1. Claude explores codebase (Explore agents)
2. Claude designs approach (Plan agent)
3. Claude writes plan to `.claude/plans/<name>.md`
4. Claude calls `ExitPlanMode`
5. User reviews plan → approves or rejects
6. On approval: Claude automatically enters execution mode with full write access
7. Context is fully preserved across the transition

### When to Use (This Project)

**Triggers:**
1. Multi-file feature touching `dashboard/` routes AND root Python files
2. Architecture change — new Docker service, new API route group, new data flow
3. Unfamiliar code — `diagnostics/` scripts, Polymarket logic, or anything in `dashboard/src/app/api/`

**Anti-triggers (skip it):**
1. Single-line change with clear scope (typo, docstring, rename)
2. Mechanical refactor — rename across files, reformat, lint fix

Caveat: if a "simple" task has unclear scope or hidden risk, use plan mode anyway. The cost of a bad change exceeds the cost of planning.

### Token Savings
No official Anthropic benchmark exists. User-reported estimates: 60-75% fewer tokens compared to jumping straight into code, because all writes are deferred until the approach is approved — no wasted edits from wrong approaches. [USER-REPORTED, NOT OFFICIAL]

---

## Verification Hooks

[VERIFIED: 2026-05-22 — hook schema confirmed via official docs; verify.ps1 tested and passing]

### Status: LIVE (requires user to write settings.json)

Claude Code supports `PostToolUse` hooks that fire after every tool call. The hook below triggers after `Write` or `Edit` events and runs the full verification suite.

### verify.ps1
Runs in ~2 seconds: pytest → ruff → mypy → jest. Located at repo root. Executable via:
```powershell
.\verify.ps1
```

### Hook Config (.claude/settings.json)
```json
{
  "model": "sonnet",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku"
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File \"C:\\Users\\julius daclan jr\\Documents\\my-cool-project\\verify.ps1\"",
            "timeout": 60,
            "statusMessage": "Running verification suite..."
          }
        ]
      }
    ]
  }
}
```

### Behavior
- PostToolUse fires AFTER the edit — cannot block, but failures appear on stderr
- Claude sees failure output instantly and can self-correct in the next turn
- Hooks live-reload on settings.json save — no restart needed
- Matcher `Write|Edit` covers the two file-modification tools

### Manual Fallback
If hooks aren't desired, run manually after any batch of edits:
```powershell
.\verify.ps1
```

### Note
Self-modification rules prevent Claude from writing `.claude/settings.json` directly. The user must write the hook config manually using the PowerShell command documented above.
