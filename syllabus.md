# Syllabus: AI Fluency Check

Per-dimension learning tracks. Each track lands the user at "Strong" on its dimension via four small, concrete steps. Sized so a motivated DevOps / SRE / Cloud engineer can complete one track in a single working session (~2-3 hours of focused effort, including the Read).

Tracks are added incrementally; F2 and F4 are the first two. The Results screen falls back to the Anchor sentence for dimensions whose track has not yet landed. A user at level Strong on any dimension sees a one-line "you're set on this; consider mentoring" note instead.

## Track structure

Each track has the same five fields:

1. **Anchor**: what Strong looks like (one sentence; canonical copy lives in [`rubric.md`](rubric.md) and [`questions.json`](questions.json)).
2. **Read**: one canonical doc, post, or spec, with a link and a sentence on what to focus on. ~5-15 minutes.
3. **Try**: one concrete exercise sized 30-60 minutes. Self-contained. No production access required. Designed so the user has something to point at when they finish.
4. **Tool**: one tool to install or sandbox to use during the Try. Free-tier where possible. Optional power-user follow-up after the basics feel normal.
5. **Next phase**: a curated pointer to deeper material (follow-on talk, paper, exercise, or adjacent topic) so motivated users have somewhere to go.

**Authored so far**: F2 and F4. The other nine tracks (F1, F3, F5, F6, A1, A2, A3, A4, A5) land progressively. Contributions welcome, see the F2 and F4 tracks below for the format.

---

## F2 · LLM mechanics

**Anchor**: You can explain how a transformer processes a prompt, what tokens and context windows mean for cost and capability, and predict where a model is likely to be confidently wrong.

### Read

[Jay Alammar, *The Illustrated Transformer*](https://jalammar.github.io/illustrated-transformer/) (2018, still the best visual explanation). 20-25 minutes if you take it slowly. Focus on the self-attention sections; the architecture details after are nice-to-have, but the *intuition* about how a transformer mixes information across positions is the load-bearing concept.

Then [Anthropic, Glossary: tokens, context windows, inference](https://docs.claude.com/en/docs/about-claude/glossary). 5 minutes. Practical, current. Confirms: tokens are not characters, the context window is shared between input and output, and output tokens cost 3-5× more than input tokens on most providers.

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

External next reads if motivated: [Karpathy, *Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g) (1hr YouTube talk; the canonical engineer-friendly deep-dive). [Anthropic, *Prompt engineering overview*](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview).

---

## F3 · Prompt engineering and RAG basics

**Anchor**: You can choose between zero-shot, few-shot, and RAG for a problem, and you know when retrieval helps versus when it just adds latency.

### Read

[Anthropic, *Prompt engineering overview*](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview). The current vendor-neutral techniques (be clear, use examples, give context, chain-of-thought) explained concretely with worked examples. 10 to 15 minutes. Focus on "Be clear and direct", "Use examples (multishot prompting)", and "Let Claude think". Skip the prompt-templates section; that is product-specific.

Then [Pinecone, *What is Retrieval Augmented Generation (RAG)?*](https://www.pinecone.io/learn/retrieval-augmented-generation/). 5 minutes. Vendor-flavoured but conceptually accurate. The load-bearing idea: RAG lets the model answer questions about information it was not trained on, without retraining. If you want the original source, the 2020 paper from Lewis et al. is at <https://arxiv.org/abs/2005.11401>; the intro and section 2 are the parts worth reading.

### Try

**Same question, three prompting strategies.** ~30 minutes. Build intuition for when retrieval pays off versus when a tight prompt is enough.

1. Pick a knowledge corpus you control: six markdown files from a project runbook, or your team's internal docs exported to plain text. Drop them in `~/scratch/rag-test/docs/`.
2. Write six questions: three where the answer is in the docs (the model would have to retrieve to know) and three where the answer is general knowledge (the model already knows).
3. **Zero-shot**: open Claude or ChatGPT in a fresh chat. Ask each of the six questions cold, no extra context. Record: correct, partially correct, or hallucinated.
4. **Few-shot**: prepend three Q-A examples (from the docs) to each prompt. Same six questions. Record again.
5. **RAG**: install the embeddings plugin (`pip install llm llm-sentence-transformers`). Index the docs: `llm embed-multi rag-test --files ~/scratch/rag-test/docs/ '*.md' --model sentence-transformers/all-MiniLM-L6-v2 --store`. For each question, retrieve top-3 chunks and pass them as context: `llm similar rag-test -c "YOUR QUESTION" -n 3 | llm "Answer this question using the context above: YOUR QUESTION"`.
6. Tabulate the three columns. Note where RAG wins (private-knowledge questions), where few-shot wins (format or style guidance), where zero-shot is fine (general knowledge), and the latency cost of the RAG path versus zero-shot.

What you should leave with: an intuitive map of when to reach for RAG. RAG earns its place for private or recent knowledge; for general questions it adds latency and a new failure mode (bad retrieval surfaces wrong chunks). For format and style consistency, few-shot beats both.

### Tool

[`llm` with embeddings](https://llm.datasette.io/en/stable/embeddings/) by Simon Willison. Same `llm` you may have installed for F2; the `embed`, `embed-multi`, and `similar` subcommands are built in. Pure-Python, SQLite-backed, runs entirely locally. The `llm-sentence-transformers` plugin gives you free CPU-only embeddings; the OpenAI or Voyage plugins give you cloud embeddings if you want them. No vector database to run, no separate service.

Power-user follow-up once the basic embed flow feels normal: [Chroma](https://docs.trychroma.com/) (`pip install chromadb`). Adds persistent collections, metadata filtering, and is the most common entry-point vector DB in production RAG stacks. The same exercise on Chroma takes about 10 lines of Python and exposes you to the collection / metadata / where-filter shape you will see in Bedrock Knowledge Bases, Vertex AI Search, and Microsoft Foundry IQ.

### Next phase

Adjacent topics worth pursuing once zero-shot vs few-shot vs RAG feels intuitive: advanced prompting techniques (chain-of-thought, self-consistency, prompt chaining) and production-grade RAG (chunking strategies, hybrid retrieval, reranking, query rewriting).

External next reads if motivated: [DAIR, *Prompt Engineering Guide*](https://www.promptingguide.ai/), still the most comprehensive open survey; pick the "Techniques" section and skim. [Anyscale, *Building RAG-based LLM Applications for Production*](https://www.anyscale.com/blog/a-comprehensive-guide-for-building-rag-based-llm-applications-part-1), long; covers chunking, eval, deployment, and costs.

---

## F4 · Agentic AI and MCP

**Anchor**: You can articulate what makes a system agentic beyond a single LLM call, and you understand MCP's role as the open standard for connecting LLMs to tools and data.

### Read

[Anthropic, *Building effective agents*](https://www.anthropic.com/research/building-effective-agents) (Schluntz and Zhang, December 2024). The clearest, most-grounded distinction between *workflows* (LLM steps wired into deterministic pipelines) and *agents* (LLM-driven loops with tool choice and observation). 12 minutes. Read sections "Augmented LLM" through "When to use agents (and when not to)" carefully; skim the worked patterns.

Then [Model Context Protocol, Introduction](https://modelcontextprotocol.io/introduction). The official spec entry point. 5 minutes. Focus on the host / client / server architecture and the four primitives: tools, resources, prompts, sampling. By the end you should be able to draw the trust boundary on a whiteboard.

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

---

## A1 · LLMOps

**Anchor**: You instrument LLM systems with cost, latency, token, and quality telemetry, and you reach for the right tool (proxy vs SDK, e.g. Helicone vs LangSmith vs Langfuse) for the situation.

### Read

[Eugene Yan, *Patterns for Building LLM-Based Systems & Products*](https://eugeneyan.com/writing/llm-patterns/). Vendor-neutral, comprehensive. ~15 minutes if focused. Skim the introduction; concentrate on the **Eval**, **Caching**, and **Monitor** sections, which carry the LLMOps shape. The cost, latency, and quality signals you instrument map directly onto what Eugene catalogues there.

Then [Langfuse, *What is LLM Observability?*](https://langfuse.com/docs). 5 minutes. Vendor-flavoured but accurate. Look at the dashboard screenshots; what they surface (cost per call, latency distribution, token in/out, trace tree, score breakdown) is the LLMOps baseline you should expect from any observability tool.

### Try

**Instrument 10 LLM calls and watch the cost, latency, and token breakdown materialise.** ~30 minutes. Build intuition for what observability gives you that plain logging does not.

1. Spin up Langfuse locally with their published `docker compose up` recipe (see <https://langfuse.com/self-hosting/local>). ~5 minutes. The web UI lands on `http://localhost:3000` once the stack is healthy.
2. In a Python REPL or a 20-line script: install `langfuse openai` (or `anthropic`), set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` from the local UI's project settings, and wrap your model client with the Langfuse `@observe` decorator.
3. Send 10 LLM calls with varied shapes: 5 short (~50 output tokens), 3 medium (~500 tokens), 2 long (~2000 tokens). Use prompts you genuinely care about (a runbook question, a code-review query, a summary, etc.).
4. Open the Langfuse UI. Click through the 10 traces.
5. Tabulate: median and p95 latency per category, total cost, tokens-in vs tokens-out ratio, the worst outlier (slowest, most expensive, longest), and which call category dominates the cost.
6. Add one deliberately bad prompt (ambiguous or ungrammatical) plus a quality score via `langfuse.score()`. Refresh the dashboard and notice how a score field changes which traces stand out.

What you should leave with: a concrete grasp of what observability gives you that `print()` does not. Per-call cost attribution catches expensive prompts you would not have flagged. The p95 latency view surfaces tail-latency outliers invisible in averages. Token in/out ratios change your prompt-budget intuition. Quality scores turn the dashboard from "what happened" into "what matters".

### Tool

[Langfuse, self-hosted via docker-compose](https://langfuse.com/self-hosting/local). Open source, runs entirely local, no signup. The stack is Postgres plus ClickHouse plus a Next.js app and comes up in one `docker compose up`. SDK available for Python and JavaScript with decorator and context-manager flavours. The instrumentation shape (a span tree, scores, prompts, tags) maps onto the same shape Langfuse Cloud serves at production scale, so the local exercise carries forward.

Power-user follow-up once the SDK pattern feels normal: [Helicone](https://www.helicone.ai/) in proxy mode. A different instrumentation shape that intercepts at the HTTP layer instead of inside your code (change your OpenAI or Anthropic base URL, no SDK install). Run the same 10-call workload through Helicone and compare what each surface lets you see. That direct contrast is the proxy-versus-SDK trade-off from Q6.3 in muscle-memory form.

### Next phase

Adjacent topics worth pursuing once LLM observability feels normal: LLM evaluation and quality (the natural progression to A5), production cost optimisation (semantic caching, smaller-model fallback for trivial queries, request batching, output token caps), and distributed tracing for LLM systems via OpenTelemetry plus OpenLLMetry.

External next reads if motivated: [Chip Huyen, *Building LLM applications for production*](https://huyenchip.com/2023/04/11/llm-engineering.html) for the broader systems framing (long; ~40 minutes; pick the "Operational considerations" sections). [Langfuse blog](https://langfuse.com/blog) for the eval-stack story and recent production patterns.
