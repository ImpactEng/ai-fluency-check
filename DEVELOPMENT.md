# AI fluency check: developer guide

Notes for running and developing the AI fluency check locally. The app is a static, no-build, no-backend implementation in vanilla HTML/CSS/JS. Open it in a browser and it runs.

## Run it

From the repo root:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Use `python3 -m http.server 8000` on systems where `python` is Python 2. Any other static-file server works (`npx serve`, `caddy file-server`, etc.).

You **cannot** double-click `index.html`. The app fetches `questions.json` over HTTP, and modern browsers block `fetch()` from `file://` URLs. The app shows a clear error screen with this instruction if it detects the failure.

## What's wired

- Three screens: landing → quiz → results.
- Quick (11 questions) and Deep (27 questions) modes. The selector is on the landing screen. Quick signals only None or Aware levels (1 question per dimension); Deep can reach Working or Strong.
- One-question-per-screen flow with Back/Next navigation. Progress indicator (`Question N of M`).
- Multiple-choice questions render as radio-button options. Free-text questions render as a textarea with the inline scoring rubric visible and a live keyword-match estimate readout.
- Per-dimension scoring (0/2 for MC, 0/1/2 for free-text via case-insensitive AND-of-OR keyword groups), mapped to None / Aware / Working / Strong levels per the rubric in [`rubric.md`](rubric.md).
- Results screen: summary pills (count of dimensions at each level), dynamic funnel CTA (strong if 3+ advanced dimensions are Aware-or-below, soft otherwise), 11 per-dimension cards with the rubric's Anchor sentence and a "Show details" drill-down per card.
- **Save progress** to localStorage automatically after every answer change. On page reload, a banner offers to resume the saved session (mode + question index + answers preserved). Cleared on completion or restart.
- **Drill-down per dimension**: each Results card has a Show details button. Expanded, it shows each question in that dimension, the user's answer, the correct answer (for MC) or scoring rubric (for free-text), and the score.
- **Syllabus tracks** (F2 + F4 at this stage): if a dimension has a syllabus block in [`questions.json`](questions.json) and the user is not at Strong, a "Show suggested next steps" toggle on the Results card reveals four sections: Read (with link), Try (numbered steps + duration + outcome), Tool (with link + power-user follow-up), Next phase (curated pointer to deeper material). Track source content lives in [`syllabus.md`](syllabus.md). The remaining 9 dimensions show Anchor only until their tracks land.
- **Anonymous local analytics**: a `track(event, payload)` hook emits to console and a capped localStorage ring buffer (`ai-fluency-check-events-v1`). Events: `page_loaded`, `assessment_started`, `assessment_resumed`, `assessment_completed`, `assessment_restarted`, `drilldown_opened`, `syllabus_opened`, `funnel_cta_shown`, `saved_session_discarded`. Replace the body of `track()` (and remove the localStorage fallback) when wiring a real backend.
- **Accessibility floor**: `aria-live="polite"` on the question container; focus moves to the first input when a question renders; Start button is disabled until questions load.

## Known gaps in v0.1

- Funnel CTAs link generically rather than to a specific destination URL.
- Analytics writes to the browser console and a localStorage ring buffer; no backend is wired.
- CSS is intentionally minimal and unpolished.
- There is no shareable-result-card affordance.

## Known limits of free-text scoring

Three questions (Q2.2, Q6.2, Q9.2) use case-insensitive keyword matching grouped as AND-of-OR:

- A semantically-correct answer that uses synonyms outside the keyword list scores 0 even when a human reviewer would give 2.
- A keyword-stuffed nonsense answer can score 2.

This is acceptable because the scoring rubric is shown to the user inline; the user sees what counts as a 2 and can self-correct. Richer free-text scoring is out of scope for this static, no-backend release.

## File layout

| File | Purpose |
|---|---|
| `index.html` | Three-screen container. Static markup; everything dynamic is in `app.js`. |
| `style.css` | Minimal, system-font, single-column responsive. No external assets. |
| `app.js` | ES-module vanilla JS. State machine, scoring, render. ~250 lines. |
| `questions.json` | Question bank, hand-derived from [`questions.md`](questions.md). |

## Quick set composition

The Quick mode runs 11 questions, one per dimension (mechanically: the first question per dimension):

`Q1.1, Q2.1, Q3.1, Q4.1, Q5.1, Q11.1, Q6.1, Q7.1, Q8.1, Q9.1, Q10.1`

Tagged via `core: true` in `questions.json`.

## Iterating on the bank

Edit `questions.md` for the human-readable copy. Re-derive `questions.json` from there when the bank changes meaningfully. Both files are hand-maintained.

## Verification checklist

- [ ] `python -m http.server 8000` from this directory; landing renders. Start button is briefly disabled and reads "Loading..." then enables.
- [ ] Quick mode → 11 questions, one per dimension, foundational tier first.
- [ ] All-correct Quick run → 11 dimensions at "Aware" with each Anchor rendered. Funnel CTA renders the soft variant.
- [ ] Deep mode → 27 questions in `questions.md` order.
- [ ] Mixed-answers Deep run → per-dimension levels reflect rubric bands (3 = Working on a 2-question dim, 4 = Strong).
- [ ] All-wrong-on-advanced Deep run → funnel CTA renders the strong variant ("your team likely has org-level gaps too...").
- [ ] Free-text scoring on Q2.2, Q6.2, Q9.2 with one strong and one weak answer; keyword-match estimate updates as you type.
- [ ] Drill-down: click "Show details" on any dimension card. Per-question detail (your answer + correct answer or scoring rubric) appears inline.
- [ ] Save-progress: start Deep mode, answer 3-4 questions, refresh the page. Resume banner appears with the right question count. Click Resume; you land on the next question.
- [ ] Restart from Results clears the localStorage save (a refresh after that lands on the landing screen with no banner).
- [ ] Browser console shows `[track]` events for: page_loaded, assessment_started, assessment_completed, drilldown_opened, funnel_cta_shown.
- [ ] Results page shows summary pills + per-dimension cards + funnel CTA in that order.
- [ ] Tab through the quiz with keyboard only: focus lands on the first option/textarea after Next/Back.
- [ ] All 27 questions read cleanly in flow.
