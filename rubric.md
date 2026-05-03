# Rubric: AI fluency check

Defines the assessment dimensions, the scoring model, and how each dimension maps to a syllabus track in the output.

This is the design document the question bank ([questions.md](questions.md)) is built against. Edit this first; regenerate or revise questions to match.

## Dimensions

Eleven dimensions. Six foundational (F1–F5 grounded in the impacteng.com.au blog post *Demystifying AI for DevOps, SRE and Cloud Engineers*; F6 added to cover 2026 production patterns), five advanced (drawn from ImpactEng's longer-form curriculum on production AI engineering).

### Foundational

| ID | Dimension | What it tests | Source |
|---|---|---|---|
| **F1** | AI/ML conceptual basics | Narrow vs General AI; supervised vs unsupervised learning; where ML sits in ops work. | Blog: "AI fundamentals" |
| **F2** | LLM mechanics | Transformers, tokens, context windows, hallucination, baseline limitations. | Blog: "How transformers work" + "Limitations" |
| **F3** | Prompt engineering and RAG basics | Few-shot vs zero-shot; the problem RAG solves; when retrieval helps and when it doesn't. | Blog: "Prompt engineering" + "RAG" |
| **F4** | Agentic AI and MCP | What makes a system "agentic"; what MCP standardises and why it matters. | Blog: "Agentic AI" + "MCP" |
| **F5** | Cloud LLM integration awareness | Bedrock, Microsoft Foundry (formerly Azure OpenAI), Vertex; tooling (Cursor, Claude Code, Cline, Aider, Windsurf, Windmill.dev). | Blog: "Integration methods" |
| **F6** | Structured outputs and function calling | JSON mode vs schema-enforced structured outputs vs function calling; constrained decoding cuts parse failures from 8–15% to under 0.1%; when to compose schema-enforced extraction with action-triggering function calls. | 2026 production patterns |

### Advanced

| ID | Dimension | What it tests | Source |
|---|---|---|---|
| **A1** | LLMOps | Observability, latency/token/cost telemetry, caching strategies, cost-per-request reasoning. | LangSmith / Helicone / Langfuse practice |
| **A2** | Agent design | Framework tradeoffs (LangChain/LangGraph, CrewAI, AutoGen/Microsoft Agent Framework, Bedrock Agents, OpenAI Agents SDK); agent memory taxonomy; multi-agent orchestration. | Agent-framework documentation + production deployment experience |
| **A3** | Cloud-native AI deployment | RAG on ECS/Fargate, Cloud Run; scale-to-zero patterns; Bedrock vs Vertex vs Microsoft Foundry as architecture choices. | Bedrock, Vertex AI, Microsoft Foundry reference architectures |
| **A4** | AI safety and security | Guardrails, red-teaming, prompt injection, PII handling, audit trails. | AgentDojo / CaMeL / AgentSys research + red-team practice |
| **A5** | Evaluation and quality | RAGAS-style metrics, ground-truth eval sets, regression testing AI pipelines. | RAGAS / DeepEval / Promptfoo / Inspect AI documentation |

## Scoring model

Per dimension, each question scores 0–2:

- **0**: wrong, blank, or off-topic.
- **1**: partially correct (gist right, key detail missing).
- **2**: correct or substantively complete.

Multiple-choice items award 0 or 2 only (binary). Free-text items support 0/1/2 against an inline scoring rubric.

The dimension's raw score (sum of its question scores) is mapped to a level:

| Level | Label | Raw-score band (out of 4, for 2 questions per dimension) |
|---|---|---|
| 0 | None | 0 |
| 1 | Aware | 1–2 |
| 2 | Working | 3 |
| 3 | Strong | 4 |

"Aware" = recognises the term; "Working" = can apply with guidance; "Strong" = can make architecture calls and teach others.

If the question count per dimension changes, re-band proportionally. Bands intentionally favour the lower end. The intent is to surface *gaps to address*, not to flatter.

## Output: syllabus tracks

One track per dimension. The user's level on a dimension determines what they see for that track.

For each dimension at level 0–2, the syllabus track contains:

1. **Anchor**: a one-sentence statement of what "Strong" looks like on this dimension.
2. **Read**: 1 doc/post/spec to read, with a link.
3. **Try**: 1 concrete exercise, sized 30–60 minutes (e.g. "spin up a local Phi-3 with Ollama and ask it three operational questions; note where it's confidently wrong").
4. **Tool**: 1 tool to install or sandbox to use.
5. **Next phase**: a curated next-step pointer (deeper reading, an adjacent topic, or a follow-on exercise) so the user has somewhere to go.

A user at level 3 on a dimension sees a one-line "you're set on this; consider mentoring" rather than a track.

The actual content of each track lives in [`syllabus.md`](syllabus.md). F2 and F4 are authored; the other 9 dimensions show their Anchor only until their tracks land. Each authored track is also embedded in [`questions.json`](questions.json) so the Results screen can render the full track inline behind a "Show suggested next steps" toggle.
