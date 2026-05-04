# Syllabus: AI Fluency Check

Per-dimension learning tracks. Each track lands the user at "Strong" on its dimension via four small, concrete steps. Sized so a motivated DevOps / SRE / Cloud engineer can complete one track in a single working session (~2-3 hours of focused effort, including the Read).

Tracks are added incrementally; F2 and F4 are the first two. The Results screen falls back to the Anchor sentence for dimensions whose track has not yet landed. A user at level Strong on any dimension sees a one-line "you're set on this; consider mentoring" note instead.

## Track structure

Each track has the same five fields:

1. **Anchor** — what Strong looks like (one sentence; canonical copy lives in [`rubric.md`](rubric.md) and [`questions.json`](questions.json)).
2. **Read** — one canonical doc, post, or spec, with a link and a sentence on what to focus on. ~5-15 minutes.
3. **Try** — one concrete exercise sized 30-60 minutes. Self-contained. No production access required. Designed so the user has something to point at when they finish.
4. **Tool** — one tool to install or sandbox to use during the Try. Free-tier where possible. Optional power-user follow-up after the basics feel normal.
5. **Next phase** — a curated pointer to deeper material (follow-on talk, paper, exercise, or adjacent topic) so motivated users have somewhere to go.

**Authored so far**: F2 and F4. The other nine tracks (F1, F3, F5, F6, A1, A2, A3, A4, A5) land progressively. Contributions welcome — see the F2 and F4 tracks below for the format.

---

## F2 — LLM mechanics

**Anchor**: You can explain how a transformer processes a prompt, what tokens and context windows mean for cost and capability, and predict where a model is likely to be confidently wrong.

### Read

[Jay Alammar — *The Illustrated Transformer*](https://jalammar.github.io/illustrated-transformer/) (2018, still the best visual explanation). 20-25 minutes if you take it slowly. Focus on the self-attention sections; the architecture details after are nice-to-have, but the *intuition* about how a transformer mixes information across positions is the load-bearing concept.

Then [Anthropic — Glossary: tokens, context windows, inference](https://docs.claude.com/en/docs/about-claude/glossary). 5 minutes. Practical, current. Confirms: tokens are not characters, the context window is shared between input and output, and output tokens cost 3-5× more than input tokens on most providers.

### Try

**Hallucination probe and tokenisation tour.** ~50 minutes. Build intuition for where models are confidently wrong and why prompts have weight.

1. Open the [OpenAI tokenizer](https://platform.openai.com/tokenizer) (or run `llm tokens "..."`). Paste five strings: an English sentence, the same with extra whitespace, a Python function with comments, a deeply-nested JSON blob, and a non-Latin script (Hindi, Mandarin, Arabic). Note the token-per-character ratio for each.
2. Open a Claude or ChatGPT session. Pick ten questions from your day-to-day ops domain where you know the right answer and the model probably doesn't. Examples: "Max pods per node on a c7i.4xlarge EKS node", "Default `tcp_keepalive_time` on Amazon Linux 2023", "Diff between Terraform `for_each` and `count` when targeting an existing list".
3. Categorise each answer: **confidently wrong** (made up a number that sounds right), **caveated correctly** (model says it doesn't know), **near-miss** (right shape, wrong specifics), **orthogonal** (answered a different question).
4. For at least two confidently-wrong answers, ask the model: "Are you sure? Cite your source." Watch how often the answer flips. This is *not* a reliable correction mechanism; it's a probe.

What you should leave with: an intuitive sense for token costs (concise prompts beat verbose ones), where models hallucinate (specific numbers, recent versions, your private infra), and why "ask it twice" is a flawed correction strategy.

### Tool

[`llm` CLI by Simon Willison](https://llm.datasette.io/en/stable/) (`pip install llm`). Pure-Python, supports OpenAI, Anthropic, local models via Ollama, and 50+ provider plugins. `llm "your prompt"` from any terminal, `llm tokens "text"` for tokenisation, `llm logs` to review the full prompt + response history. Free for everything except the LLM provider's own API costs.

Power-user follow-up once `llm` feels normal: install [Ollama](https://ollama.com/) and pull a small model (`ollama run llama3.2:3b`). Run the same hallucination probe on the local model. The wrongness gradient between a 3B local and a frontier API model is itself an education.

### Next phase

Adjacent topics worth pursuing once the mechanics feel intuitive: prompt-engineering techniques that work *with* the mechanics, and cost-per-request reasoning that follows from token economics.

External next reads if motivated: [Karpathy — *Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g) (1hr YouTube talk; the canonical engineer-friendly deep-dive). [Anthropic — *Prompt engineering overview*](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview).

---

## F4 — Agentic AI and MCP

**Anchor**: You can articulate what makes a system agentic beyond a single LLM call, and you understand MCP's role as the open standard for connecting LLMs to tools and data.

### Read

[Anthropic — *Building effective agents*](https://www.anthropic.com/research/building-effective-agents) (Schluntz and Zhang, December 2024). The clearest, most-grounded distinction between *workflows* (LLM steps wired into deterministic pipelines) and *agents* (LLM-driven loops with tool choice and observation). 12 minutes. Read sections "Augmented LLM" through "When to use agents (and when not to)" carefully; skim the worked patterns.

Then [Model Context Protocol — Introduction](https://modelcontextprotocol.io/introduction). The official spec entry point. 5 minutes. Focus on the host / client / server architecture and the four primitives: tools, resources, prompts, sampling. By the end you should be able to draw the trust boundary on a whiteboard.

### Try

**Run an MCP-enabled coding session against a sandbox directory and observe the plan-act-observe loop.** ~45 minutes.

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code` (Node 18+) or use the [official installer](https://docs.claude.com/en/docs/claude-code/quickstart). Cursor, Cline, or Aider work for the same exercise; all four are MCP-capable hosts.
2. Make a scratch directory: `mkdir -p ~/scratch/mcp-test && cd ~/scratch/mcp-test`.
3. Drop three short text files into it: a runbook stub (`runbook.md`), a config snippet (`nginx.conf`), and a half-broken bash script (`backup.sh` with one obvious bug).
4. Run `claude` in that directory. Without naming the files, ask: *"Summarise the three files in this directory, then suggest a fix for the script."*
5. Watch the agent loop in real time: which tool calls fire (`Read`, `Edit`, `Bash`), in what order, where it pauses to think, where it asks permission, what it observes after each call.
6. Open a second terminal, edit `runbook.md` mid-session to add a new line, and ask the agent to re-read. Observe how the host (Claude Code) hands the new file content back through the tool surface.

What you should leave with: an intuitive feel for the plan-act-observe loop, the difference between a workflow (predetermined steps) and an agent (the LLM picks each step), and why the MCP surface matters when an agent talks to multiple data sources at once.

### Tool

[Claude Code](https://docs.claude.com/en/docs/claude-code/overview). Anthropic's official CLI agent, currently powered by Claude Opus 4.7. Free during this exercise via your usage allowance. Works in any terminal. Requires Node 18+ and an Anthropic account.

Power-user follow-up once Claude Code feels normal: configure a [filesystem MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) and a [git MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/git) inside Claude Desktop or Cursor, and re-run the Try exercise from there. You will see the host / server boundary live, and the same task running against a different host with the same tool surface.

### Next phase

Adjacent topics for deeper depth: MCP server design (registry, custom servers, governance), and agent-framework comparisons (LangGraph, CrewAI, Microsoft Agent Framework, Bedrock Agents, OpenAI Agents SDK, agent-memory taxonomy).

If you score Strong on this dimension, the highest-leverage next move is to *write* an MCP server for an internal tool your team already uses (read-only kubectl, internal docs search, ticket-system query) and run it against Claude Code or Cursor for a week of real ops work.

