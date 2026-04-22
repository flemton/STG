from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - build-time guard
    print("Missing dependency: pypdf. Install it with `python3 -m pip install --user pypdf`.", file=sys.stderr)
    raise SystemExit(1) from exc


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path("/Users/newton/Downloads/GHANA-STG-2017-1.pdf")
OUTPUT_FILE = PROJECT_ROOT / "src" / "data" / "generated-corpus.ts"
AUDIT_FILE = PROJECT_ROOT / "docs" / "stg-corpus-audit.md"

HEADING_RE = re.compile(r"^(\d+[A-Za-z]?)\s+([A-Z][A-Za-z0-9][A-Za-z0-9 ,()'/-]{2,110})$")
CHAPTER_RE = re.compile(r"^Chapter\s+\d+:\s+(.+)$")
TOC_CHAPTER_RE = re.compile(r"^Chapter\s+(\d+)\.\s+(.+?)\s+(\d+)$", re.I)
TOC_ITEM_RE = re.compile(r"^(\d+)\.\s*(.+)$")

BLOCK_LABELS = {
    "causes": "causes",
    "symptoms": "symptoms",
    "signs": "signs",
    "signs and symptoms": "signs_and_symptoms",
    "diagnostic clues": "diagnostic_clues",
    "investigations": "investigations",
    "treatment": "treatment",
    "treatment objectives": "treatment_objectives",
    "non-pharmacological treatment": "non_pharmacological_treatment",
    "pharmacological treatment": "pharmacological_treatment",
    "referral criteria": "referral_criteria",
    "prevention": "prevention",
    "counselling points": "counselling_points",
    "complications": "complications",
    "diagnosis": "diagnosis",
}

IGNORE_HEADING_TITLES = {
    "standard treatment guidelines, 7th edition, 2017",
    "signs",
    "symptoms",
    "treatment",
    "investigations",
    "pharmacological treatment",
    "non-pharmacological treatment",
    "referral criteria",
    "causes",
    "introduction",
    "anaemia",
}

HEADER_PATTERNS = (
    re.compile(r"^Standard Treatment Guidelines, 7th Edition, 2017"),
    re.compile(r"^Part\s+\d+:"),
    re.compile(r"^Republic of Ghana$"),
    re.compile(r"^Ministry of Health$"),
    re.compile(r"^Ghana National Drugs Programme"),
    re.compile(r"^\s*\d+\s*$"),
    re.compile(r"^Page\s+\d+$", re.I),
)

COMMON_TITLE_ALIASES = {
    "amoebic liver access": ["amoebic liver abscess"],
    "bronchial asthma": ["asthma"],
    "deep vein thrombosis dvt": ["deep vein thrombosis", "dvt"],
    "gastro oesophageal reflux disease": ["gord", "gerd"],
    "haemophilus influenzae type b disease": ["hib disease", "hib"],
    "hypertension in pregnancy": ["pregnancy induced hypertension", "pih"],
    "peptic ulcer disease": ["pud"],
    "sti related neonatal conjunctivitis opthalmia neonatorum": [
        "ophthalmia neonatorum",
        "ophthalmia",
    ],
    "trigerminal neuralgia": ["trigeminal neuralgia"],
    "urinary tract infection": ["uti", "utis"],
    "urinary tract infections": ["urinary tract infection", "uti", "utis"],
}

TOC_PAGE_RANGE = range(2, 9)


def normalize_line(value: str) -> str:
    return (
        value.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2022", " y ")
        .replace("\u00a0", " ")
        .replace("\uf0b7", " y ")
        .replace("\t", " ")
        .replace("\ufffd", "")
        .strip()
    )


def normalize_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value.lower())).strip()


def fuzzy_key(value: str) -> str:
    return normalize_search_text(value).replace(" ", "")


def tokenize_search(value: str) -> list[str]:
    return [token for token in normalize_search_text(value).split(" ") if len(token) > 1]


def is_header_or_noise(line: str) -> bool:
    if not line:
        return True
    if "...." in line:
        return True
    if len(line) == 1:
        return True
    if re.fullmatch(r"[A-Za-z]", line):
        return True
    return any(pattern.match(line) for pattern in HEADER_PATTERNS)


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def split_items(lines: Iterable[str]) -> list[str]:
    items: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if not current:
            return
        item = " ".join(current)
        item = re.sub(r"\s+", " ", item).strip(" -;:,")
        if item and item.lower() not in {"y", "none", "nil"}:
            items.append(item)
        current.clear()

    for raw in lines:
        line = normalize_line(raw)
        if not line or line == "y":
            flush()
            continue

        if line.startswith(("y ", "- ", "* ")):
            flush()
            current.append(line[2:].strip())
            continue

        current.append(line)

    flush()
    return list(dict.fromkeys(items))


def clean_term_items(items: Iterable[str], title: str) -> list[str]:
    cleaned: list[str] = []
    title_key = normalize_search_text(title)
    noise_values = {
        "adult",
        "adults",
        "child",
        "children",
        "infant",
        "infants",
        "neonate",
        "neonates",
        "look at",
        "feel",
        "decide",
        "treatment plan",
        "treatment algorithm",
    }

    for raw_item in items:
        item = re.sub(r"\s+", " ", raw_item).strip(" -")
        item = re.sub(rf"\s*-\s*{re.escape(title)}\s*$", "", item, flags=re.I)
        item = re.sub(r"\s*-\s*Chapter\s+\d+.*$", "", item, flags=re.I)
        item = re.sub(r"\s+", " ", item).strip(" -")
        if not item:
            continue

        normalized = normalize_search_text(item)
        if not normalized or normalized == title_key:
            continue
        if normalized in noise_values:
            continue
        if normalized.startswith("chapter "):
            continue
        if normalized.startswith("table ") or normalized.startswith("box "):
            continue
        if "standard treatment guidelines" in normalized:
            continue

        cleaned.append(item)

    return list(dict.fromkeys(cleaned))


def build_aliases(title: str) -> list[str]:
    aliases: set[str] = set()
    normalized = normalize_search_text(title)

    if normalized in COMMON_TITLE_ALIASES:
        aliases.update(COMMON_TITLE_ALIASES[normalized])

    no_parens = re.sub(r"\([^)]*\)", "", title).strip(" -")
    if no_parens and no_parens != title:
        aliases.add(no_parens)

    for match in re.finditer(r"\(([^)]{2,30})\)", title):
        value = match.group(1).strip()
        if value:
            aliases.add(value)

    singular = re.sub(r"\bInfections\b", "Infection", title)
    singular = re.sub(r"\bDiseases\b", "Disease", singular)
    if singular != title:
        aliases.add(singular)

    if "Liver Access" in title:
        aliases.add(title.replace("Access", "Abscess"))
    if "Opthalmia" in title:
        aliases.add(title.replace("Opthalmia", "Ophthalmia"))
    if "Trigerminal" in title:
        aliases.add(title.replace("Trigerminal", "Trigeminal"))

    return sorted({alias for alias in aliases if normalize_search_text(alias)})


@dataclass
class TocEntry:
    number: str
    title: str
    chapter: str
    start_page: int
    pdf_start_page: int | None = None


@dataclass
class Section:
    title: str
    number: str
    chapter: str
    pages: set[int] = field(default_factory=set)
    content: list[str] = field(default_factory=list)
    source: str = "body"

    @property
    def id(self) -> str:
        return slugify(self.title)


def is_condition_heading(line: str) -> tuple[str, str] | None:
    match = HEADING_RE.match(line)
    if not match:
        return None

    number, title = match.groups()
    title = re.sub(r"\s+", " ", title).strip()
    if title.lower() in IGNORE_HEADING_TITLES:
        return None
    if title.startswith("Evidence Rating"):
        return None
    return number, title


def parse_section_blocks(lines: list[str]) -> dict[str, list[str]]:
    blocks: dict[str, list[str]] = {value: [] for value in BLOCK_LABELS.values()}
    current = "body"
    misc: list[str] = []

    for raw_line in lines:
        line = normalize_line(raw_line)
        if not line:
            continue

        key = BLOCK_LABELS.get(line.lower())
        if key:
            current = key
            continue

        if current == "body":
            misc.append(line)
        else:
            blocks[current].append(line)

    blocks["body"] = misc
    return blocks


def clean_toc_text_fragment(value: str) -> str:
    value = normalize_line(value)
    value = re.sub(r"[.]{2,}", " ", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value


def parse_toc_tail(value: str) -> tuple[str, int | None]:
    cleaned = clean_toc_text_fragment(value)
    if not cleaned:
        return "", None

    match = re.match(r"^(.*?)(\d+)$", cleaned)
    if not match:
        return cleaned, None

    title = match.group(1).strip(" .")
    page = int(match.group(2))
    return title, page


def parse_toc_entries(reader: PdfReader) -> list[TocEntry]:
    lines: list[str] = []
    for page_index in TOC_PAGE_RANGE:
        if page_index >= len(reader.pages):
            break
        lines.extend((reader.pages[page_index].extract_text() or "").splitlines())

    entries: list[TocEntry] = []
    current_chapter = ""
    pending_number: str | None = None
    pending_title_parts: list[str] = []

    for raw_line in lines:
        line = clean_toc_text_fragment(raw_line)
        if not line:
            continue
        if line in {"Table of Contents", "Forms", "Index", "list of Tables", "List of tables"}:
            continue
        if re.fullmatch(r"[ivxlcdm]+", line.lower()):
            continue
        if line.startswith("Standard Treatment Guidelines"):
            continue
        if line.startswith("Management of specific STI"):
            continue

        chapter_match = TOC_CHAPTER_RE.match(line)
        if chapter_match:
            current_chapter = chapter_match.group(2).strip()
            continue

        item_match = TOC_ITEM_RE.match(line)
        if item_match:
            if pending_number and pending_title_parts:
                pending_number = None
                pending_title_parts = []

            pending_number = item_match.group(1)
            title_part, page = parse_toc_tail(item_match.group(2))
            pending_title_parts = [title_part] if title_part else []
            if page is not None:
                entries.append(
                    TocEntry(
                        number=pending_number,
                        title=" ".join(part for part in pending_title_parts if part).strip(),
                        chapter=current_chapter,
                        start_page=page,
                    )
                )
                pending_number = None
                pending_title_parts = []
            continue

        if not pending_number:
            continue

        title_part, page = parse_toc_tail(line)
        if title_part:
            pending_title_parts.append(title_part)
        if page is not None:
            entries.append(
                TocEntry(
                    number=pending_number,
                    title=" ".join(part for part in pending_title_parts if part).strip(),
                    chapter=current_chapter,
                    start_page=page,
                )
            )
            pending_number = None
            pending_title_parts = []

    deduped: list[TocEntry] = []
    seen: set[tuple[str, str, int]] = set()
    for entry in entries:
        key = (entry.number, normalize_search_text(entry.title), entry.start_page)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)

    return deduped


def extract_page_texts(reader: PdfReader) -> list[str]:
    return [(page.extract_text() or "") for page in reader.pages]


def detect_pdf_page_offset(page_texts: list[str]) -> int:
    offsets: list[int] = []

    for pdf_page_number, page_text in enumerate(page_texts, start=1):
        lines = [normalize_line(line) for line in page_text.splitlines()[:12]]
        printed_page: int | None = None

        for line in lines:
            if re.fullmatch(r"\d{1,3}", line):
                value = int(line)
                if 1 <= value <= len(page_texts):
                    printed_page = value
                    break

        if printed_page is None:
            continue

        offsets.append(pdf_page_number - printed_page)

    if not offsets:
        return 0

    counts: dict[int, int] = {}
    for offset in offsets:
        counts[offset] = counts.get(offset, 0) + 1

    return max(counts.items(), key=lambda item: item[1])[0]


def attach_pdf_pages_to_toc_entries(toc_entries: list[TocEntry], page_texts: list[str]) -> int:
    offset = detect_pdf_page_offset(page_texts)
    page_count = len(page_texts)

    for entry in toc_entries:
        entry.pdf_start_page = max(1, min(page_count, entry.start_page + offset))

    return offset


def extract_sections(page_texts: list[str]) -> list[Section]:
    sections: list[Section] = []
    current_section: Section | None = None
    current_chapter = ""

    for page_number, page_text in enumerate(page_texts, start=1):
        lines = [normalize_line(line) for line in page_text.splitlines()]
        cleaned = [line for line in lines if not is_header_or_noise(line)]
        if not cleaned:
            continue

        for line in cleaned:
            chapter_match = CHAPTER_RE.match(line)
            if chapter_match:
                current_chapter = chapter_match.group(1).strip()
                continue

            heading = is_condition_heading(line)
            if heading:
                number, title = heading
                current_section = Section(title=title, number=number, chapter=current_chapter)
                current_section.pages.add(page_number)
                sections.append(current_section)
                continue

            if current_section is None:
                continue

            current_section.pages.add(page_number)
            current_section.content.append(line)

    return sections


def line_matches_toc_heading(line: str, toc_entry: TocEntry) -> bool:
    heading = is_condition_heading(line)
    if heading and heading[0] == toc_entry.number:
        return True

    normalized_line = normalize_search_text(line)
    title_key = normalize_search_text(toc_entry.title)
    if normalized_line == title_key:
        return True
    if normalized_line.startswith(f"{toc_entry.number} {title_key}"):
        return True
    if normalized_line.endswith(title_key):
        return True
    if title_key in normalized_line and normalized_line.split(" ", 1)[0].isdigit():
        return True
    return False


def extract_fallback_section(
    toc_entry: TocEntry,
    next_entry: TocEntry | None,
    page_texts: list[str]
) -> Section:
    pages: set[int] = set()
    content: list[str] = []
    started = False
    stop = False
    start_page = toc_entry.pdf_start_page or toc_entry.start_page
    next_start_page = (
        next_entry.pdf_start_page if next_entry and next_entry.pdf_start_page is not None else next_entry.start_page if next_entry else len(page_texts)
    )
    final_page = min(next_start_page, len(page_texts))

    for page_number in range(start_page, final_page + 1):
        raw_lines = [normalize_line(line) for line in page_texts[page_number - 1].splitlines()]
        cleaned = [line for line in raw_lines if not is_header_or_noise(line)]

        if not started:
            matching_indexes = [
                index for index, line in enumerate(cleaned) if line_matches_toc_heading(line, toc_entry)
            ]
            if matching_indexes:
                started = True
                pages.add(page_number)
                start_index = matching_indexes[-1] if page_number == start_page else matching_indexes[0]
                relevant_lines = cleaned[start_index + 1 :]
            else:
                relevant_lines = []
        else:
            relevant_lines = cleaned

        for line in relevant_lines:
            if next_entry and line_matches_toc_heading(line, next_entry):
                stop = True
                break

            pages.add(page_number)
            content.append(line)

        if stop:
            break

    if not content:
        start_page = toc_entry.pdf_start_page or toc_entry.start_page
        end_page = min(
            ((next_entry.pdf_start_page or next_entry.start_page) - 1) if next_entry else len(page_texts),
            len(page_texts)
        )
        if end_page < start_page:
            end_page = start_page

        for page_number in range(start_page, end_page + 1):
            raw_lines = [normalize_line(line) for line in page_texts[page_number - 1].splitlines()]
            cleaned = [line for line in raw_lines if not is_header_or_noise(line)]
            pages.add(page_number)
            content.extend(cleaned)

    return Section(
        title=toc_entry.title,
        number=toc_entry.number,
        chapter=toc_entry.chapter,
        pages=pages,
        content=content,
        source="toc-fallback",
    )


def merge_sections_with_toc(
    sections: list[Section],
    toc_entries: list[TocEntry],
    page_texts: list[str]
) -> tuple[list[Section], list[TocEntry]]:
    merged: list[Section] = []
    used_indexes: set[int] = set()
    fallback_entries: list[TocEntry] = []

    for index, toc_entry in enumerate(toc_entries):
        next_entry = toc_entries[index + 1] if index + 1 < len(toc_entries) else None
        best_index: int | None = None
        best_score: tuple[int, int] | None = None

        for section_index, section in enumerate(sections):
            if section_index in used_indexes:
                continue
            title_match = normalize_search_text(section.title) == normalize_search_text(toc_entry.title)
            number_match = section.number == toc_entry.number
            if not number_match and not title_match:
                continue

            first_page = min(section.pages) if section.pages else 9999
            chapter_penalty = 0 if normalize_search_text(section.chapter) == normalize_search_text(toc_entry.chapter) else 1
            target_page = toc_entry.pdf_start_page or toc_entry.start_page
            page_distance = abs(first_page - target_page)
            title_penalty = 0 if title_match else 1
            score = (title_penalty, chapter_penalty, page_distance)

            if best_score is None or score < best_score:
                best_score = score
                best_index = section_index

        if best_index is not None and best_score is not None and best_score[1] <= 8:
            source_section = sections[best_index]
            used_indexes.add(best_index)
            merged.append(
                Section(
                    title=toc_entry.title,
                    number=toc_entry.number,
                    chapter=toc_entry.chapter,
                    pages=set(source_section.pages),
                    content=list(source_section.content),
                    source="body",
                )
            )
        else:
            fallback_entries.append(toc_entry)
            merged.append(extract_fallback_section(toc_entry, next_entry, page_texts))

    return merged, fallback_entries


def build_generated_entry(section: Section) -> dict | None:
    blocks = parse_section_blocks(section.content)

    causes = clean_term_items(split_items(blocks["causes"]), section.title)
    symptoms = clean_term_items(split_items(blocks["symptoms"]), section.title)
    signs = clean_term_items(split_items(blocks["signs"]), section.title)
    signs_and_symptoms = clean_term_items(split_items(blocks["signs_and_symptoms"]), section.title)
    diagnostic_clues = clean_term_items(split_items(blocks["diagnostic_clues"]), section.title)
    diagnosis = clean_term_items(split_items(blocks["diagnosis"]), section.title)
    investigations = clean_term_items(split_items(blocks["investigations"]), section.title)
    treatment = clean_term_items(split_items(blocks["treatment"]), section.title)
    treatment_objectives = clean_term_items(split_items(blocks["treatment_objectives"]), section.title)
    non_pharmacological = clean_term_items(split_items(blocks["non_pharmacological_treatment"]), section.title)
    pharmacological = clean_term_items(split_items(blocks["pharmacological_treatment"]), section.title)
    referral = clean_term_items(split_items(blocks["referral_criteria"]), section.title)
    prevention = clean_term_items(split_items(blocks["prevention"]), section.title)
    counselling = clean_term_items(split_items(blocks["counselling_points"]), section.title)
    complications = clean_term_items(split_items(blocks["complications"]), section.title)
    diagnostic_notes = clean_term_items(split_items(blocks["body"] + blocks["diagnosis"]), section.title)
    if not diagnostic_notes:
        diagnostic_notes = clean_term_items(split_items(section.content), section.title)

    if signs_and_symptoms:
        if not symptoms:
            symptoms = signs_and_symptoms[:]
        if not signs:
            signs = signs_and_symptoms[:]

    if diagnostic_clues:
        for clue in diagnostic_clues:
            if clue not in signs:
                signs.append(clue)

    diagnosable = bool(
        symptoms
        or signs
        or investigations
        or diagnostic_clues
        or diagnosis
        or treatment
        or pharmacological
        or non_pharmacological
        or diagnostic_notes
    )
    if not diagnosable:
        return None

    pages = sorted(section.pages)
    page_label = str(pages[0]) if len(pages) == 1 else f"{pages[0]}-{pages[-1]}"
    aliases = build_aliases(section.title)
    search_tokens = sorted(
        {
            *tokenize_search(section.title),
            *tokenize_search(section.chapter),
            *(token for alias in aliases for token in tokenize_search(alias)),
        }
    )

    return {
        "id": section.id,
        "title": section.title,
        "category": section.chapter or "Ghana STG",
        "pdfPages": page_label,
        "aliases": aliases,
        "normalizedTitle": normalize_search_text(section.title),
        "searchTokens": search_tokens,
        "fuzzyTitle": fuzzy_key(section.title),
        "causes": causes,
        "symptoms": symptoms,
        "signs": signs,
        "signsAndSymptoms": signs_and_symptoms,
        "diagnosticClues": diagnostic_clues,
        "diagnosis": diagnosis,
        "investigations": investigations,
        "treatmentObjectives": treatment_objectives,
        "nonPharmacologicalTreatment": non_pharmacological,
        "pharmacologicalTreatment": pharmacological,
        "treatment": treatment,
        "referralCriteria": referral,
        "prevention": prevention,
        "counsellingPoints": counselling,
        "complications": complications,
        "diagnosticNotes": diagnostic_notes,
    }


def write_typescript(entries: list[dict]) -> None:
    payload = json.dumps(entries, indent=2, ensure_ascii=True)
    content = (
        "// Generated by scripts/build_stg_corpus.py from the Ghana STG PDF.\n"
        "export type GeneratedCorpusEntry = {\n"
        "  id: string;\n"
        "  title: string;\n"
        "  category: string;\n"
        "  pdfPages: string;\n"
        "  aliases: string[];\n"
        "  normalizedTitle: string;\n"
        "  searchTokens: string[];\n"
        "  fuzzyTitle: string;\n"
        "  causes: string[];\n"
        "  symptoms: string[];\n"
        "  signs: string[];\n"
        "  signsAndSymptoms: string[];\n"
        "  diagnosticClues: string[];\n"
        "  diagnosis: string[];\n"
        "  investigations: string[];\n"
        "  treatmentObjectives: string[];\n"
        "  nonPharmacologicalTreatment: string[];\n"
        "  pharmacologicalTreatment: string[];\n"
        "  treatment: string[];\n"
        "  referralCriteria: string[];\n"
        "  prevention: string[];\n"
        "  counsellingPoints: string[];\n"
        "  complications: string[];\n"
        "  diagnosticNotes: string[];\n"
        "};\n\n"
        f"export const generatedCorpus: GeneratedCorpusEntry[] = {payload} as const;\n"
    )
    OUTPUT_FILE.write_text(content)


def write_audit_report(
    toc_entries: list[TocEntry],
    sections: list[Section],
    fallback_entries: list[TocEntry],
    generated_entries: list[dict],
    page_offset: int,
) -> None:
    generated_titles = {normalize_search_text(entry["title"]) for entry in generated_entries}
    missing = [entry for entry in toc_entries if normalize_search_text(entry.title) not in generated_titles]

    lines = [
        "# STG Corpus Audit",
        "",
        f"- PDF TOC entries parsed: `{len(toc_entries)}`",
        f"- Body sections detected: `{len(sections)}`",
        f"- Generated searchable entries: `{len(generated_entries)}`",
        f"- TOC fallbacks used: `{len(fallback_entries)}`",
        f"- TOC entries still missing after generation: `{len(missing)}`",
        f"- Detected PDF page offset: `+{page_offset}` PDF pages relative to printed STG page numbers",
        "",
        "## TOC fallback entries",
        "",
    ]

    if fallback_entries:
        lines.extend(
            [
                f"- `{entry.number}. {entry.title}` [{entry.chapter}] p{entry.start_page}"
                for entry in fallback_entries
            ]
        )
    else:
        lines.append("- None")

    lines.extend(["", "## Remaining missing TOC entries", ""])
    if missing:
        lines.extend(
            [f"- `{entry.number}. {entry.title}` [{entry.chapter}] p{entry.start_page}" for entry in missing]
        )
    else:
        lines.append("- None")

    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_FILE.write_text("\n".join(lines) + "\n")


def main() -> int:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    reader = PdfReader(str(pdf_path))
    toc_entries = parse_toc_entries(reader)
    page_texts = extract_page_texts(reader)
    page_offset = attach_pdf_pages_to_toc_entries(toc_entries, page_texts)
    body_sections = extract_sections(page_texts)
    merged_sections, fallback_entries = merge_sections_with_toc(body_sections, toc_entries, page_texts)

    entries = [entry for section in merged_sections if (entry := build_generated_entry(section))]
    deduped = list({entry["id"]: entry for entry in entries}.values())

    write_typescript(deduped)
    write_audit_report(toc_entries, body_sections, fallback_entries, deduped, page_offset)
    print(
        f"Wrote {len(deduped)} generated STG entries to {OUTPUT_FILE} "
        f"using {len(toc_entries)} TOC entries, page offset +{page_offset}, "
        f"and {len(fallback_entries)} TOC fallbacks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
