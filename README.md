# learn-mod

An AI tutor that teaches for understanding rather than memorization. Before teaching, it maps what you already know and agrees your goal with you. Then it plans a dependency graph from basic truths to that goal, and teaches it one node at a time, with a graded quiz after each node.

It isn't tied to one AI tool. The same files work with:

| Harness | Status |
|---|---|
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) | **Primary.** Pick any model per session: DeepSeek, Anthropic, OpenAI, Kimi, GLM, or any OpenAI-compatible endpoint. Covered by an automated smoke test. |
| [Claude Code](https://claude.com/claude-code) | Supported |
| [OpenAI Codex CLI](https://github.com/openai/codex) | Supported |

## How it works

- **The method** is in two portable skills (`SKILL.md` files):
  - `teach`: probe → plan → teach, built on two principles: start from unconditional truths, and make every step feel like something you could have discovered yourself.
  - `visualize`: small, correct diagrams.
- **The quizzes** come from a small MCP server, `learn`, that every harness connects to. A quiz takes three steps:
  1. `quiz_create`: the tutor writes the question, options, answer and explanation. The server validates them, shuffles the options, flags answers that stand out by their form, and returns the question *without* the answer.
  2. The tutor asks you, using the harness's question popup or plain chat. "I don't know" is always a choice.
  3. `quiz_grade`: the server grades your answer deterministically and returns ✓/✗, the correct answer, the explanation, and *which* wrong option you picked. Each wrong option is written as a specific misconception, so your choice tells the tutor what to fix.

  `quiz_summary` tallies the session's results per concept.
- **Single sessions.** Each session is self-contained; nothing about you is saved between sessions yet. At the end, the tutor prints a recap (starting point, what's now solid, open gaps, the updated map) that you can paste into your next session. Saving state between sessions is the first item in [TODO.md](TODO.md).

## Requirements

- Node.js 22 or newer
- One of the harnesses above, plus an API key for at least one model provider

## Quick start: DeepSeek Harness

```sh
git clone <this repo> learn && cd learn
node scripts/learn.mjs dsh
```

This command:
1. installs the quiz server's dependencies;
2. writes `harness/dsh/learn.cordis.yml`, a dsh patch that connects the `learn` MCP server;
3. starts the dsh Web UI with `npx @deepseek-ai/dsh web --patch …`, from this directory.

Then, in the browser:

1. **Settings → Models**: add a DeepSeek API key, or **Add model provider** for Anthropic, OpenAI, etc. **Custom model API** covers OpenRouter, a local Ollama/llama.cpp server, or any OpenAI-compatible gateway.
2. **Choose workspace**: add this directory.
3. Start a session: *"Teach me how public-key cryptography works."*

**Swapping models:** choose a model in the session's model picker. Each session keeps the model it started with, so to compare models on the same topic, start one session per model. Some reasoning models behind third-party gateways need `compat` settings; see dsh's [model guide](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/guide/providers.md).

**Check the setup without spending tokens:**

```sh
node scripts/dsh-smoke.mjs
```

This runs one headless dsh session against a scripted mock model. It checks that dsh offers the model the quiz tools and the `teach` skill, loads `AGENTS.md`, and runs a full `quiz_create` → `quiz_grade` round trip through dsh's MCP bridge.

> dsh is in developer preview, and its maintainers warn of breaking changes. If the smoke test fails after a dsh update, try pinning a version: change `@deepseek-ai/dsh@latest` in `scripts/learn.mjs` to a known-good version.

## Claude Code

```sh
node scripts/learn.mjs setup claude
claude
```

Setup writes `.mcp.json` for the `learn` server; approve it when Claude Code asks. Skills come from `.claude/skills`, a symlink to `.agents/skills`. If your checkout can't hold symlinks, setup copies the folder instead. `CLAUDE.md` imports `AGENTS.md`.

## OpenAI Codex CLI

```sh
node scripts/learn.mjs setup codex   # runs: codex mcp add learn -- node <path>/mcp/src/server.mjs
codex
```

Codex reads `AGENTS.md` and `.agents/skills` from this directory. Note that `codex mcp add` registers the server for your Codex user, not just this project. Codex has no quiz popup, so questions are asked in chat and you reply with a letter.

## Layout

| Path | What |
|---|---|
| `.agents/skills/teach/` | The teaching method. `references/` holds how to ask quizzes in each harness, and the researcher brief for fact-checking. |
| `.agents/skills/visualize/` | Diagram guidance |
| `AGENTS.md` / `CLAUDE.md` | Workspace instructions: "you are a tutor, use the teach skill" |
| `mcp/` | The `learn` MCP server. `src/quiz.mjs` is the harness-neutral grading core; `src/server.mjs` is the MCP wrapper. Run `npm test` here. |
| `scripts/learn.mjs` | Per-harness setup, and the dsh launcher |
| `scripts/dsh-smoke.mjs` | End-to-end dsh check against a mock model |
| `TODO.md` | The roadmap: persistence, source management, more test types, Obsidian |

## Customizing

The method is a default, not a rule. Edit `.agents/skills/teach/SKILL.md` to fit how you learn: for example, more expository and less Socratic, shorter probing, or a different recap format. You can also just tell the tutor in the session.

## Known limitations

- Quizzes are multiple choice only. Written, numeric and other test types are planned in [TODO.md](TODO.md).
- `quiz_create`'s arguments, including the answer key, are part of the tool call. Harnesses that show tool-call arguments (usually collapsed) could reveal the answer to a learner who expands them before answering.
- No state is kept between sessions (see [TODO.md](TODO.md)).

## Credits

Adapted from Amos Blomqvist's [learn](https://github.com/amosblomqvist/learn), a [pi](https://github.com/earendil-works/pi) configuration from the video [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU). The teaching method and the quiz design come from that project. This version generalizes them for any learner and makes them work across harnesses.
