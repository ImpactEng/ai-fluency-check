"""Guards against drift in the AI fluency check assessment artifacts.

Three classes of regression are caught here:

1. Drift between `questions.md` (human-readable bank) and `questions.json`
   (machine-readable bank consumed by the JS app). When a stem, option count,
   correct-index, dimension tag, or question type diverges between the two,
   the app scores wrongly.
2. Schema regressions in `questions.json` (missing fields, out-of-range
   indices, unknown dimensions, broken Quick-set invariant).
3. Style and terminology drift in public-facing files (`&mdash;` entities,
   literal em-dashes, deprecated terms like "Azure OpenAI" or "AutoGen"
   used outside historical "(formerly ...)" contexts).
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_MD = ROOT / "questions.md"
QUESTIONS_JSON = ROOT / "questions.json"

# Public-facing files. Em-dashes are forbidden here per the project style rule.
PUBLIC_FILES: list[Path] = [
    ROOT / "index.html",
    ROOT / "DEVELOPMENT.md",
]

# Files where current-tense use of deprecated terminology is forbidden.
TERMINOLOGY_GUARDED_FILES: list[Path] = [
    ROOT / "README.md",
    ROOT / "rubric.md",
    ROOT / "questions.md",
    ROOT / "syllabus.md",
    ROOT / "DEVELOPMENT.md",
    ROOT / "index.html",
    ROOT / "app.js",
    ROOT / "style.css",
]


# ---------------- helpers ----------------


def _normalise(s: str) -> str:
    """Normalise stem text for cross-format comparison.

    The human-readable MD and the JSON differ on cosmetic punctuation:
    backticks for code spans, curly vs straight quotes, em/en-dash vs
    hyphen, single vs double quotes. None of those mean different things
    in this context, so treat them as equivalent before comparing.
    """
    s = s.replace("`", "")
    # Dash family → ASCII hyphen
    s = s.replace("—", "-").replace("–", "-")
    # Curly quotes → straight
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("‘", "'").replace("’", "'")
    # Treat single and double straight quotes as the same so MD's "anomaly"
    # and JSON's 'anomaly' don't trip the test
    s = s.replace('"', "'")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _parse_questions_md() -> dict[str, dict]:
    """Parse questions.md into {Qx.y: {dimension, type, stem, options, correct_idx}}.

    Section format:
        ### Qx.y [Dim] (MC|Free text) — Difficulty
        Stem text on the line(s) immediately following the header.

        - a) option text
        - b) option text ✓
        - c) option text
        - d) option text

        Source: ...
    """
    text = QUESTIONS_MD.read_text(encoding="utf-8")
    header_re = re.compile(
        r"^###\s+Q(?P<id>\d+\.\d+)\s+\[(?P<dim>[FA]\d+)\]\s+\((?P<type>MC|Free text)\)",
        re.MULTILINE,
    )
    matches = list(header_re.finditer(text))
    out: dict[str, dict] = {}

    for i, m in enumerate(matches):
        qid = f"Q{m.group('id')}"
        # Skip past the rest of the header line (e.g. " — Core" / " — Applied")
        eol = text.find("\n", m.end())
        section_start = eol + 1 if eol != -1 else m.end()
        section_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        section = text[section_start:section_end]

        # Stem: everything from after the header up to the first option line
        # (or the first **Scoring rubric** for free text).
        stop_re = re.compile(r"^(?:-\s+[a-d]\)|\*\*Scoring rubric\*\*)", re.MULTILINE)
        stop_m = stop_re.search(section)
        stem_block = section[: stop_m.start()] if stop_m else section
        stem_lines = [ln.strip() for ln in stem_block.splitlines() if ln.strip()]
        stem = " ".join(stem_lines)

        qtype = "mc" if m.group("type") == "MC" else "free"
        options: list[str] = []
        correct_idx: int | None = None

        if qtype == "mc":
            opt_re = re.compile(r"^-\s+([a-d])\)\s+(.+)$", re.MULTILINE)
            for j, opt_m in enumerate(opt_re.finditer(section)):
                line = opt_m.group(0)
                opt_text = opt_m.group(2).rstrip()
                if "✓" in line:
                    correct_idx = j
                    opt_text = opt_text.replace("✓", "").rstrip()
                options.append(opt_text)

        out[qid] = {
            "dimension": m.group("dim"),
            "type": qtype,
            "stem": stem,
            "options": options,
            "correct_idx": correct_idx,
        }

    return out


def _load_questions_json() -> dict:
    return json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))


# ---------------- bank consistency: MD vs JSON ----------------


def test_every_md_question_has_json_entry() -> None:
    md = _parse_questions_md()
    data = _load_questions_json()
    json_ids = {q["id"] for q in data["questions"]}
    md_ids = set(md.keys())
    only_in_md = md_ids - json_ids
    only_in_json = json_ids - md_ids
    assert (
        not only_in_md
    ), f"Questions in MD but missing from JSON: {sorted(only_in_md)}"
    assert (
        not only_in_json
    ), f"Questions in JSON but missing from MD: {sorted(only_in_json)}"


def test_md_and_json_dimensions_agree() -> None:
    md = _parse_questions_md()
    data = _load_questions_json()
    by_id = {q["id"]: q for q in data["questions"]}
    failures: list[str] = []
    for qid, m in md.items():
        if qid not in by_id:
            continue
        if m["dimension"] != by_id[qid]["dimension"]:
            failures.append(
                f"{qid}: MD={m['dimension']!r} but JSON={by_id[qid]['dimension']!r}"
            )
    assert not failures, "Dimension drift:\n  " + "\n  ".join(failures)


def test_md_and_json_question_types_agree() -> None:
    md = _parse_questions_md()
    data = _load_questions_json()
    by_id = {q["id"]: q for q in data["questions"]}
    failures: list[str] = []
    for qid, m in md.items():
        if qid not in by_id:
            continue
        if m["type"] != by_id[qid]["type"]:
            failures.append(f"{qid}: MD={m['type']!r} but JSON={by_id[qid]['type']!r}")
    assert not failures, "Type drift:\n  " + "\n  ".join(failures)


def test_md_and_json_stems_agree() -> None:
    """Catches drift like the Q8.2 'Azure OpenAI' vs 'Microsoft Foundry' bug.

    Backticks and whitespace are normalised so trivial markdown formatting
    differences don't trigger a false positive.
    """
    md = _parse_questions_md()
    data = _load_questions_json()
    by_id = {q["id"]: q for q in data["questions"]}
    failures: list[str] = []
    for qid, m in md.items():
        if qid not in by_id:
            continue
        md_stem = _normalise(m["stem"])
        json_stem = _normalise(by_id[qid]["text"])
        if md_stem != json_stem:
            failures.append(
                f"{qid} stem drift:\n    MD:   {md_stem}\n    JSON: {json_stem}"
            )
    assert not failures, "Stem drift:\n  " + "\n  ".join(failures)


def test_mc_correct_indexes_align() -> None:
    md = _parse_questions_md()
    data = _load_questions_json()
    by_id = {q["id"]: q for q in data["questions"]}
    failures: list[str] = []
    for qid, m in md.items():
        if m["type"] != "mc" or qid not in by_id:
            continue
        j = by_id[qid]
        if j["type"] != "mc":
            continue
        if m["correct_idx"] is None:
            failures.append(f"{qid}: MD has no ✓ on any option")
            continue
        if m["correct_idx"] != j["correct"]:
            failures.append(
                f"{qid}: MD ✓ on option {m['correct_idx']} but JSON correct={j['correct']}"
            )
        if len(m["options"]) != len(j["options"]):
            failures.append(
                f"{qid}: MD has {len(m['options'])} options but JSON has {len(j['options'])}"
            )
    assert not failures, "MC alignment failures:\n  " + "\n  ".join(failures)


# ---------------- JSON schema ----------------


def test_questions_json_top_level_keys() -> None:
    data = _load_questions_json()
    for k in ("version", "dimensions", "questions"):
        assert k in data, f"Missing top-level key: {k}"


def test_dimensions_well_formed() -> None:
    data = _load_questions_json()
    failures: list[str] = []
    for dim_id, dim in data["dimensions"].items():
        if not re.match(r"^[FA]\d+$", dim_id):
            failures.append(f"Bad dimension id: {dim_id}")
        if dim.get("tier") not in {"foundational", "advanced"}:
            failures.append(f"{dim_id}: bad tier {dim.get('tier')!r}")
        if not dim.get("name"):
            failures.append(f"{dim_id}: missing name")
        if not dim.get("anchor"):
            failures.append(f"{dim_id}: missing anchor sentence")
    assert not failures, "Dimension schema failures:\n  " + "\n  ".join(failures)


def test_question_required_fields() -> None:
    data = _load_questions_json()
    required = ("id", "dimension", "tier", "core", "type", "text")
    failures: list[str] = []
    for q in data["questions"]:
        qid = q.get("id", "<unknown>")
        for k in required:
            if k not in q:
                failures.append(f"{qid}: missing field {k!r}")
        if q.get("tier") not in {"foundational", "advanced"}:
            failures.append(f"{qid}: bad tier {q.get('tier')!r}")
        if q.get("type") not in {"mc", "free"}:
            failures.append(f"{qid}: bad type {q.get('type')!r}")
        if not isinstance(q.get("core"), bool):
            failures.append(
                f"{qid}: 'core' must be bool, got {type(q.get('core')).__name__}"
            )
    assert not failures, "Required-field failures:\n  " + "\n  ".join(failures)


def test_mc_correct_index_in_range() -> None:
    data = _load_questions_json()
    failures: list[str] = []
    for q in data["questions"]:
        if q.get("type") != "mc":
            continue
        opts = q.get("options")
        if not isinstance(opts, list) or len(opts) < 2:
            failures.append(f"{q.get('id')}: needs at least 2 options, got {opts!r}")
            continue
        c = q.get("correct")
        if not isinstance(c, int) or not (0 <= c < len(opts)):
            failures.append(
                f"{q.get('id')}: correct={c!r} out of range for {len(opts)} options"
            )
    assert not failures, "MC range failures:\n  " + "\n  ".join(failures)


def test_free_text_has_keyword_groups() -> None:
    data = _load_questions_json()
    failures: list[str] = []
    for q in data["questions"]:
        if q.get("type") != "free":
            continue
        groups = q.get("keyword_groups")
        if not isinstance(groups, list) or not groups:
            failures.append(f"{q.get('id')}: missing or empty keyword_groups")
            continue
        for i, group in enumerate(groups):
            if not isinstance(group, list) or not group:
                failures.append(
                    f"{q.get('id')} keyword_groups[{i}]: empty or wrong type"
                )
    assert not failures, "Free-text schema failures:\n  " + "\n  ".join(failures)


def test_question_dimensions_exist_in_dimensions_block() -> None:
    data = _load_questions_json()
    dim_ids = set(data["dimensions"].keys())
    failures = [
        f"{q['id']} references unknown dimension {q['dimension']!r}"
        for q in data["questions"]
        if q.get("dimension") not in dim_ids
    ]
    assert not failures, "Dimension reference failures:\n  " + "\n  ".join(failures)


def test_syllabus_block_schema_when_present() -> None:
    """Per-dimension `syllabus` block is optional. When present, validate shape.

    Required: all four sections (read, try, tool, next_phase), each with at
    least one of summary / steps / outcome. Unknown top-level keys fail
    loudly so the schema doesn't silently grow.
    """
    data = _load_questions_json()
    failures: list[str] = []

    for dim_id, dim in data["dimensions"].items():
        syllabus = dim.get("syllabus")
        if syllabus is None:
            continue

        if not isinstance(syllabus, dict):
            failures.append(f"{dim_id}.syllabus: not a dict")
            continue

        for sec in ("read", "try", "tool", "next_phase"):
            if sec not in syllabus:
                failures.append(f"{dim_id}.syllabus: missing '{sec}' section")
                continue
            section = syllabus[sec]
            if not isinstance(section, dict):
                failures.append(f"{dim_id}.syllabus.{sec}: not a dict")
                continue

            has_content = (
                section.get("summary") or section.get("steps") or section.get("outcome")
            )
            if not has_content:
                failures.append(
                    f"{dim_id}.syllabus.{sec}: needs at least one of summary / steps / outcome"
                )

            if "url" in section and not isinstance(section["url"], str):
                failures.append(f"{dim_id}.syllabus.{sec}.url: must be a string")

            if "duration_minutes" in section and not isinstance(
                section["duration_minutes"], int
            ):
                failures.append(
                    f"{dim_id}.syllabus.{sec}.duration_minutes: must be an int"
                )

            if "steps" in section and not isinstance(section["steps"], list):
                failures.append(f"{dim_id}.syllabus.{sec}.steps: must be a list")

        valid_top = {"read", "try", "tool", "next_phase"}
        unknown = set(syllabus.keys()) - valid_top
        if unknown:
            failures.append(
                f"{dim_id}.syllabus: unknown top-level keys {sorted(unknown)}"
            )

    assert not failures, "Syllabus schema failures:\n  " + "\n  ".join(failures)


def test_quick_set_has_one_core_question_per_dimension() -> None:
    """Quick mode contract: exactly one `core: true` question per dimension that has any."""
    data = _load_questions_json()
    core = [q for q in data["questions"] if q.get("core")]
    counts = Counter(q["dimension"] for q in core)
    question_dims = {q["dimension"] for q in data["questions"]}

    failures: list[str] = []
    for dim in sorted(question_dims):
        c = counts.get(dim, 0)
        if c != 1:
            failures.append(f"{dim}: {c} core questions (expected 1)")
    extra = set(counts) - question_dims
    if extra:
        failures.append(f"core questions in unknown dims: {sorted(extra)}")
    assert not failures, "Quick-set invariant failures:\n  " + "\n  ".join(failures)


# ---------------- style and terminology guards ----------------


def test_no_em_dash_entity_in_public_prototype_files() -> None:
    """`&mdash;` is forbidden in public-facing prototype files per the project style rule."""
    failures = []
    for path in PUBLIC_FILES:
        content = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(content.splitlines(), start=1):
            if "&mdash;" in line:
                failures.append(
                    f"{path.name}:{line_no} contains &mdash;: {line.strip()}"
                )
    assert not failures, "Em-dash entity guard:\n  " + "\n  ".join(failures)


def test_no_literal_em_dash_in_public_prototype_files() -> None:
    """Literal U+2014 is forbidden in public-facing prototype files."""
    failures = []
    for path in PUBLIC_FILES:
        content = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(content.splitlines(), start=1):
            if "—" in line:
                failures.append(
                    f"{path.name}:{line_no} contains literal em-dash: {line.strip()}"
                )
    assert not failures, "Literal em-dash guard:\n  " + "\n  ".join(failures)


def test_azure_openai_only_in_historical_contexts() -> None:
    """'Azure OpenAI' is allowed only in historical 'formerly' contexts.

    The 2026 brand is Microsoft Foundry. New prose must use the new name.
    Research/audit files (freshness-scan, consistency-check) are excluded.
    """
    failures = []
    for path in TERMINOLOGY_GUARDED_FILES:
        content = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(content.splitlines(), start=1):
            if "Azure OpenAI" not in line:
                continue
            if "formerly Azure OpenAI" in line or "from Azure OpenAI" in line:
                continue
            failures.append(f"{path.name}:{line_no}: {line.strip()}")
    assert not failures, (
        "'Azure OpenAI' used in current context (use 'Microsoft Foundry'):\n  "
        + "\n  ".join(failures)
    )


def test_autogen_only_in_historical_contexts() -> None:
    """'AutoGen' is allowed only alongside or after 'Microsoft Agent Framework'."""
    failures = []
    for path in TERMINOLOGY_GUARDED_FILES:
        content = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(content.splitlines(), start=1):
            if "AutoGen" not in line:
                continue
            if (
                "formerly AutoGen" in line
                or "AutoGen/Microsoft Agent Framework" in line
                or "Microsoft Agent Framework (formerly AutoGen)" in line
            ):
                continue
            failures.append(f"{path.name}:{line_no}: {line.strip()}")
    assert not failures, (
        "'AutoGen' used in current context (use 'Microsoft Agent Framework'):\n  "
        + "\n  ".join(failures)
    )
