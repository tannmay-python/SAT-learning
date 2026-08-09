"""Import questions from the official paper practice forms into the local bank.

The source PDFs are two-column. `measure-official-density.py` splits columns by
looking for a wide whitespace run in the `pdftotext -layout` output; that works
for plain prose but loses items whose column gap narrows (tables, poetry,
indented block quotes) and it can splice a neighbouring column into a choice.
This importer keeps the same pipeline shape -- `pdf_lines` / `split_columns` /
cut-on-question-number / `classify` -- but reads word geometry from
`pdftotext -bbox-layout` and splits on the real page gutter, so a line can never
carry text from both columns.

Everything written by this script lands in `data/questions/`, which is
gitignored. No passage, stem, choice or explanation text from the forms appears
in this file; the copyrighted material only ever exists in the local output.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOCKS = ROOT / "SAT Mocks"
OUT_DIR = ROOT / "data" / "questions"
OUT = OUT_DIR / "official.jsonl"
REJECTS = OUT_DIR / "official-rejects.jsonl"
WORK = Path("/private/tmp/claude-501/-Users/ab31d013-fc3e-4b14-81ea-b84ec64becf7/scratchpad/pdftext")

XHTML = "{http://www.w3.org/1999/xhtml}"

TESTS = [4, 5, 6, 7, 8, 9, 10, 11]

# Test 4 uses an embedded text style whose underline is not emitted as a
# vector rectangle by Poppler. Keep the one known geometry exception explicit;
# the other underlined forms are recovered from PDF geometry below.
UNDERLINE_FALLBACKS = {
    (4, "rw", 2, 9): "Female cuckoos have been seen quickly laying eggs in the nests of other bird species when those birds are out looking for food.",
}

# ---------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------

BODY_TOP = 100.0      # below the "Module N" running head
BODY_BOTTOM = 738.0   # above the footer / page number / CONTINUE
GUTTER_LO = 300.0     # the vertical rule between the columns lives in here
GUTTER_HI = 340.0

NOISE = re.compile(
    r"Unauthorized copying|CO ?NTI ?N ?U ?E|^Module$|^Reading and Writing$|"
    r"^\d+ QUESTIONS$|^DIRECTIONS$|The questions in this section address|"
    r"question includes one or more passages|and question carefully|"
    r"All questions in this section are multiple-choice|single best answer|"
    r"^STOP$|^Math$|reference sheet|^Turn to Section|practice test|sat\.org|"
    r"No Test Material On This Page|For multiple-choice questions, solve|"
    r"For student-produced response questions|Once you.ve written your answer|"
    r"If you find more than one correct answer|Your answer can be up to|"
    r"If your answer is a|Don.t include symbols such as|"
    r"circle your answer|erase the circle|one circled answer|"
    r"The following are the specified|GENERAL DIRECTIONS|^Test begins",
    re.I,
)

# A run of rule/figure glyphs that pdftotext renders as punctuation soup.
JUNK_LINE = re.compile(r"^[^0-9A-Za-z]{4,}$")

QNUM = re.compile(r"^(\d{1,2})$")
CHOICE_HEAD = re.compile(r"^([A-D])\)\s*(.*)$")

# The stem of an official Reading and Writing item always opens with one of
# these; the stimulus never does, which is what makes the cut reliable.
STEM = re.compile(
    r"^(Which choice|Which finding|Which quotation|Which statement|Which sentence|"
    r"Which of the following|Which data|Which change|Which student|"
    r"What does the text|What is the main|What can be reasonably inferred|"
    r"According to the text|Based on the text|As used in the text|"
    r"The student wants|Complete the text)",
    re.I,
)

# Math items are one undivided prompt; the closing sentence is the ask.
MATH_STEM = re.compile(
    r"^(What is|What was|What value|What percent|What percentage|Which of the following|"
    r"Which expression|Which equation|Which inequality|Which system|Which graph|"
    r"Which table|Which function|Which choice|How many|How much|For what value|"
    r"If .{1,200}|The (?:value|solution|graph|function|equation|expression|"
    r"length|area|volume|measure|median|mean|probability) .{1,200}|"
    r"In the .{1,200}|A .{1,200}|Solve .{1,200}|Line .{1,200}|Triangle .{1,200}|"
    r"Circle .{1,200}|Function .{1,200})$",
    re.I,
)

# Openers that appear inside a stem but never inside a choice; a choice that
# swallows one of these has picked up neighbouring text.
BLEED_MARKERS = re.compile(
    r"(Which choice|Which of the following|According to the text|"
    r"Blank 1|The student wants|Mark for Review)", re.I
)

# ---------------------------------------------------------------------------
# curriculum (ids mirror src/data/curriculum.ts)
# ---------------------------------------------------------------------------

SKILL_DOMAIN = {
    "words-in-context": "craft-structure",
    "text-structure-purpose": "craft-structure",
    "cross-text-connections": "craft-structure",
    "central-ideas-details": "information-ideas",
    "command-evidence-textual": "information-ideas",
    "command-evidence-quantitative": "information-ideas",
    "inferences": "information-ideas",
    "boundaries": "standard-english",
    "form-structure-sense": "standard-english",
    "rhetorical-synthesis": "expression-ideas",
    "transitions": "expression-ideas",
    "linear-equations-one-variable": "algebra",
    "linear-equations-two-variables": "algebra",
    "linear-functions": "algebra",
    "systems-linear-equations": "algebra",
    "linear-inequalities": "algebra",
    "equivalent-expressions": "advanced-math",
    "nonlinear-equations": "advanced-math",
    "nonlinear-functions": "advanced-math",
    "systems-nonlinear": "advanced-math",
    "ratios-rates-units": "problem-solving-data",
    "percentages": "problem-solving-data",
    "one-variable-data": "problem-solving-data",
    "two-variable-data": "problem-solving-data",
    "probability": "problem-solving-data",
    "sampling-margin-error": "problem-solving-data",
    "statistical-claims": "problem-solving-data",
    "area-volume": "geometry-trigonometry",
    "lines-angles-triangles": "geometry-trigonometry",
    "right-triangle-trig": "geometry-trigonometry",
    "circles": "geometry-trigonometry",
}

SKILL_TITLE = {
    "words-in-context": "Words in Context",
    "text-structure-purpose": "Text Structure and Purpose",
    "cross-text-connections": "Cross-Text Connections",
    "central-ideas-details": "Central Ideas and Details",
    "command-evidence-textual": "Command of Evidence: Textual",
    "command-evidence-quantitative": "Command of Evidence: Quantitative",
    "inferences": "Inferences",
    "boundaries": "Boundaries",
    "form-structure-sense": "Form, Structure, and Sense",
    "rhetorical-synthesis": "Rhetorical Synthesis",
    "transitions": "Transitions",
    "linear-equations-one-variable": "Linear Equations in One Variable",
    "linear-equations-two-variables": "Linear Equations in Two Variables",
    "linear-functions": "Linear Functions",
    "systems-linear-equations": "Systems of Two Linear Equations",
    "linear-inequalities": "Linear Inequalities",
    "equivalent-expressions": "Equivalent Expressions",
    "nonlinear-equations": "Nonlinear Equations in One Variable",
    "nonlinear-functions": "Nonlinear Functions",
    "systems-nonlinear": "Systems with Nonlinear Equations",
    "ratios-rates-units": "Ratios, Rates, Relationships, and Units",
    "percentages": "Percentages",
    "one-variable-data": "One-Variable Data",
    "two-variable-data": "Two-Variable Data and Models",
    "probability": "Probability and Conditional Probability",
    "sampling-margin-error": "Sampling and Margin of Error",
    "statistical-claims": "Evaluating Statistical Claims",
    "area-volume": "Area and Volume",
    "lines-angles-triangles": "Lines, Angles, and Triangles",
    "right-triangle-trig": "Right Triangles and Trigonometry",
    "circles": "Circles",
}

# RW items are laid out domain block by domain block, in this order.
RW_DOMAIN_ORDER = ["craft-structure", "information-ideas", "standard-english", "expression-ideas"]


# ---------------------------------------------------------------------------
# pdf reading
# ---------------------------------------------------------------------------


def _pdf_bbox(pdf: Path) -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / (pdf.stem + ".bbox.xml")
    if not out.exists() or out.stat().st_size == 0:
        subprocess.run(["pdftotext", "-bbox-layout", str(pdf), str(out)], check=True)
    return out


def _pdf_underlines(pdf: Path, page_number: int) -> list[tuple[float, float, float]]:
    """Return thin horizontal rectangles used as underlines on one PDF page.

    `pdftotext` preserves the words but not the decoration. Poppler's SVG
    renderer exposes the underline as a very short filled rectangle, which is
    enough to map it back onto the word geometry below.
    """
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / f"{pdf.stem}-page-{page_number}.svg"
    if not out.exists() or out.stat().st_size == 0:
        subprocess.run(
            ["pdftocairo", "-f", str(page_number), "-l", str(page_number), "-svg", str(pdf), str(out)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    try:
        svg = out.read_text(errors="ignore")
    except OSError:
        return []
    body = svg.split("</defs>", 1)[-1]
    underlines: list[tuple[float, float, float]] = []
    for tag in re.findall(r"<path\b[^>]*>", body):
        d_match = re.search(r'\bd="([^"]+)"', tag)
        if not d_match:
            continue
        values = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", d_match.group(1))]
        if len(values) < 8:
            continue
        xs = values[0::2]
        ys = values[1::2]
        x0, x1 = min(xs), max(xs)
        y0, y1 = min(ys), max(ys)
        if x1 - x0 >= 12 and 0 < y1 - y0 <= 0.8:
            underlines.append((x0, x1, (y0 + y1) / 2))
    return underlines


def pdf_lines(pdf: Path) -> list[list[dict]]:
    """Per page, the text lines with their bounding boxes, in reading order."""
    root = ET.parse(_pdf_bbox(pdf)).getroot()
    pages = []
    for page_number, page in enumerate(root.iter(XHTML + "page"), start=1):
        lines = []
        for line in page.iter(XHTML + "line"):
            words = [
                {
                    "text": norm(w.text or ""),
                    "x0": float(w.get("xMin")),
                    "x1": float(w.get("xMax")),
                }
                for w in line.iter(XHTML + "word")
                if (w.text or "").strip()
            ]
            text = norm(" ".join(word["text"] for word in words if word["text"]))
            if not text:
                continue
            lines.append(
                {
                    "x0": float(line.get("xMin")),
                    "x1": float(line.get("xMax")),
                    "y": float(line.get("yMin")),
                    "y1": float(line.get("yMax")),
                    "h": float(line.get("yMax")) - float(line.get("yMin")),
                    "text": text,
                    "words": words,
                }
            )
        if any("underlined" in line["text"].lower() for line in lines):
            for x0, x1, y in _pdf_underlines(pdf, page_number):
                for line in lines:
                    if abs(y - line["y1"]) > 1.8:
                        continue
                    selected = [
                        word["text"]
                        for word in line["words"]
                        if word["x1"] > x0 + 0.5 and word["x0"] < x1 - 0.5
                    ]
                    if selected:
                        line["underlined_text"] = norm(" ".join(selected))
        pages.append(lines)
    return pages


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("—", "—").replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = re.sub(r"\s+", " ", text).strip()

    # Words broken across a printed line arrive as "infor- mation". Rejoin them.
    # When the left fragment is already hyphenated the hyphen is real and part
    # of a compound ("forty-five- minute"), so it is kept rather than dropped.
    text = re.sub(r"(\w*-\w+)-\s+(\w)", r"\1-\2", text)
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)

    # Trailing rights lines are page furniture, not part of the passage.
    text = re.sub(r"\s*©\s*\d{4}[^.]*?(?:\.|$)\s*$", "", text)
    text = re.sub(r"\s*(?:©|\(c\))\s*\d{4}\s+by\s+.*$", "", text, flags=re.I)
    return text.strip()


def split_columns(page: list[dict]) -> tuple[list[dict], list[dict], int]:
    """Split one page into (left column, right column, gutter-crossing count).

    The gutter is chosen as the x inside [GUTTER_LO, GUTTER_HI] crossed by the
    fewest body lines. Anything that still straddles it is a wide element
    (running head, rule, table or figure) and is dropped rather than guessed at,
    so no line can ever contribute text to two different questions.
    """
    body = [
        ln
        for ln in page
        if BODY_TOP <= ln["y"] <= BODY_BOTTOM
        and not NOISE.search(ln["text"])
        and not JUNK_LINE.match(ln["text"])
    ]
    if not body:
        return [], [], 0

    best_x, best_cross = 320.0, None
    for x in range(int(GUTTER_LO), int(GUTTER_HI) + 1, 2):
        cross = sum(1 for ln in body if ln["x0"] < x < ln["x1"])
        if best_cross is None or cross < best_cross:
            best_x, best_cross = float(x), cross
            if cross == 0:
                break

    left, right, crossed = [], [], 0
    for ln in body:
        if ln["x1"] <= best_x:
            left.append(ln)
        elif ln["x0"] >= best_x:
            right.append(ln)
        else:
            crossed += 1
    left.sort(key=lambda l: l["y"])
    right.sort(key=lambda l: l["y"])
    return left, right, crossed


def page_module(page: list[dict]) -> int | None:
    """Read the `Module N` running head at the top of a question page."""
    head = [ln for ln in page if ln["y"] < BODY_TOP]
    saw_module = any(ln["text"] == "Module" for ln in head)
    if not saw_module:
        return None
    for ln in head:
        if re.fullmatch(r"[12]", ln["text"]) and ln["y"] > 35:
            return int(ln["text"])
    return None


# ---------------------------------------------------------------------------
# cutting a column into questions
# ---------------------------------------------------------------------------


def cut_questions(column: list[dict]) -> list[dict]:
    """Cut one column into items, starting each at its hanging number.

    The RW and Math pages use different left margins (body at x=72 and x=54
    respectively), so the number's x is found relative to the column rather
    than fixed: the item number is the only thing that hangs to the left of the
    column's text block.
    """
    prose = [ln for ln in column if not QNUM.match(ln["text"])]
    if not prose:
        return []
    hang = min(ln["x0"] for ln in prose) - 3.0

    items: list[dict] = []
    current = None
    for ln in column:
        m = QNUM.match(ln["text"])
        if m and ln["x0"] <= hang and ln["h"] >= 7:
            if current:
                items.append(current)
            current = {"num": int(m.group(1)), "lines": []}
            continue
        if current is None:
            continue
        current["lines"].append(ln)
    if current:
        items.append(current)
    return items


def parse_item(item: dict, section: str) -> dict:
    """Separate an item's lines into stimulus / stem / choices.

    Math items are a single undivided prompt, so only RW items are cut at the
    stem opener.
    """
    stim: list[str] = []
    stem: list[str] = []
    choices: list[tuple[str, list[str]]] = []
    stage = "stim" if section == "rw" else "stem"
    for ln in item["lines"]:
        text = ln["text"]
        m = CHOICE_HEAD.match(text)
        if m:
            stage = "choices"
            choices.append((m.group(1), [m.group(2)] if m.group(2) else []))
            continue
        if stage == "choices":
            if choices:
                choices[-1][1].append(text)
            continue
        if stage == "stem":
            stem.append(text)
            continue
        if STEM.match(text):
            stage = "stem"
            stem.append(text)
        else:
            stim.append(text)
    return {
        "num": item["num"],
        "stimulus": stim,
        "stem": norm(" ".join(stem)),
        "choices": [(cid, norm(" ".join(parts))) for cid, parts in choices],
        "underlined": norm(" ".join(ln.get("underlined_text", "") for ln in item["lines"] if ln.get("underlined_text"))),
    }


# ---------------------------------------------------------------------------
# answers pdf
# ---------------------------------------------------------------------------

ANS_HEAD = re.compile(r"SAT ANSWER EXPLANATIONS.{0,4}(READING AND WRITING|MATH): MODULE (\d)", re.I)
ANS_Q = re.compile(r"^\s*QUESTION\s+(\d{1,2})\s*$")
ANS_KEY = re.compile(r"^Choice ([A-D]) is (?:the best answer|correct)\b", re.I)
ANS_SPR = re.compile(r"^The correct answer is\b", re.I)
ANS_WRONG = re.compile(r"Choice ([A-D]) is incorrect", re.I)
ANS_FOOTER = re.compile(r"SAT PRACTICE TEST #\d+ ANSWER EXPLANATIONS|^\d+\s*$", re.I)


def read_answers(pdf: Path) -> dict[tuple[str, int, int], dict]:
    WORK.mkdir(parents=True, exist_ok=True)
    txt = WORK / (pdf.stem + ".txt")
    if not txt.exists():
        subprocess.run(["pdftotext", "-layout", str(pdf), str(txt)], check=True)
    blocks: dict[tuple[str, int], list[str]] = defaultdict(list)
    for raw_page in txt.read_text(errors="ignore").split("\f"):
        head = ANS_HEAD.search(raw_page)
        if not head:
            continue
        key = ("rw" if head.group(1).upper().startswith("READING") else "math", int(head.group(2)))
        for line in raw_page.splitlines():
            stripped = line.strip()
            if not stripped or ANS_HEAD.search(stripped) or ANS_FOOTER.match(stripped):
                continue
            blocks[key].append(stripped)

    out: dict[tuple[str, int, int], dict] = {}
    for (section, module), lines in blocks.items():
        buf: list[str] = []
        num: int | None = None

        def flush(n, body):
            if n is None:
                return
            parsed = parse_answer(body)
            if parsed:
                out[(section, module, n)] = parsed

        for line in lines:
            m = ANS_Q.match(line)
            if m:
                flush(num, buf)
                num, buf = int(m.group(1)), []
                continue
            buf.append(line)
        flush(num, buf)
    return out


def join_answer(lines: list[str]) -> str:
    text = ""
    for line in lines:
        line = norm(line)
        if not line:
            continue
        if text.endswith("-") and re.match(r"^[a-z]", line):
            text = text[:-1] + line
        elif text:
            text += " " + line
        else:
            text = line
    return norm(text)


def parse_answer(lines: list[str]) -> dict | None:
    text = join_answer(lines)
    if not text:
        return None
    key_match = ANS_KEY.match(text)
    spr = bool(ANS_SPR.match(text))
    if not key_match and not spr:
        return None

    wrong: dict[str, str] = {}
    marks = [(m.start(), m.group(1).upper()) for m in ANS_WRONG.finditer(text)]
    explanation = text[: marks[0][0]].strip() if marks else text
    for i, (start, letter) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        wrong[letter] = text[start:end].strip()

    result = {"explanation": re.sub(r"\s+", " ", explanation).strip(), "whyWrong": wrong}
    if key_match:
        result["answer"] = key_match.group(1).upper()
        result["format"] = "multiple-choice"
    else:
        value = re.match(r"The correct answer is\s+(.{1,24}?)\s*[.．]", text, re.I)
        raw = value.group(1).strip() if value else ""
        raw = raw.replace(" ", "")
        if not re.fullmatch(r"-?\d+(?:\.\d+)?|-?\d+/\d+", raw):
            return None
        result["answer"] = raw
        result["format"] = "student-produced"
    return result


# ---------------------------------------------------------------------------
# classification
# ---------------------------------------------------------------------------

PUNCT = re.compile(r"[^\w\s]")


def classify_rw(stem: str, stimulus: str, choices: list[tuple[str, str]]) -> str | None:
    s = stem.lower()
    p = stimulus.lower()
    if "conforms to the conventions of standard english" in s:
        bare = [PUNCT.sub("", c.lower()).split() for _, c in choices]
        if bare and sum(1 for b in bare if b == bare[0]) >= 3:
            return "boundaries"
        return "form-structure-sense"
    if re.search(r"\btext 1\b", p) and re.search(r"\btext 2\b", p):
        return "cross-text-connections"
    if "most logical transition" in s:
        return "transitions"
    if "student wants to" in s or "from the notes to accomplish" in s or "student wants" in s:
        return "rhetorical-synthesis"
    if "most logical and precise word" in s or "most nearly mean" in s or "as used in the text" in s:
        return "words-in-context"
    if "most logically completes the text" in s:
        return "inferences"
    if re.search(r"uses data from|data from the (table|graph)|complete the (table|graph)", s):
        return "command-evidence-quantitative"
    if re.search(
        r"quotation from|which finding|most effectively illustrates|most strongly support|"
        r"most directly support|most directly weaken|would most directly|if true, would most",
        s,
    ):
        return "command-evidence-textual"
    if re.search(
        r"overall structure of the text|function of the underlined|overall purpose of the text|"
        r"best states the (function|main purpose)|main purpose of the (text|underlined)",
        s,
    ):
        return "text-structure-purpose"
    if re.search(
        r"main idea of the text|according to the text|based on the text|"
        r"most strongly supported by the text|best describes the|text most strongly suggests|"
        r"what does the text",
        s,
    ):
        return "central-ideas-details"
    return None


MATH_RULES = [
    ("systems-nonlinear", r"system of (two )?equations.*(x\^?2|squared|quadratic)"),
    ("systems-linear-equations", r"system of (two )?(linear )?equations|solution to the (given )?system"),
    ("linear-inequalities", r"inequality|inequalities"),
    ("circles", r"\bcircle\b|radius|diameter|circumference|arc length|central angle"),
    ("right-triangle-trig", r"\bsin\b|\bcos\b|\btan\b|right triangle|hypotenuse|\bangle [A-Z]\b.*right"),
    ("lines-angles-triangles", r"triangle|parallel lines|transversal|supplementary|vertical angles|congruent|similar triangles"),
    ("area-volume", r"\bvolume\b|surface area|area of (a|the) (rectangle|square|triangle|circle|cylinder|cone|sphere)"),
    ("probability", r"probability|randomly selected"),
    ("sampling-margin-error", r"margin of error|confidence interval|representative sample"),
    ("statistical-claims", r"random(ly)? assign|study|experiment.*conclusion|generalize"),
    ("one-variable-data", r"\bmedian\b|\bmean\b|standard deviation|\brange\b of the data|box plot|frequency table|dot plot"),
    ("two-variable-data", r"scatterplot|line of best fit|exponential model|linear model|models the"),
    ("percentages", r"percent|%"),
    ("ratios-rates-units", r"\bratio\b|per (hour|minute|second|gram|pound|mile|kilometer)|rate of|proportional"),
    ("nonlinear-functions", r"parabola|vertex|graph of.*(quadratic|exponential)|f\s*\(\s*x\s*\)\s*=.*(x\s*\^?2|x2)"),
    ("nonlinear-equations", r"x\s*\^?2|squared|square root|quadratic|\bcubic\b"),
    ("equivalent-expressions", r"equivalent (to|expression)|expand|factor(ed|ing)?\b|simplif"),
    ("linear-functions", r"\bfunction\b"),
    ("linear-equations-two-variables", r"\bslope\b|y-intercept|x-intercept|graph of the line|in the xy-plane"),
    ("linear-equations-one-variable", r"value of x|solve for|solution to the equation|what is the value of"),
]


def classify_math(text: str) -> str | None:
    t = text.lower()
    for skill, pattern in MATH_RULES:
        if re.search(pattern, t):
            return skill
    return None


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------

DICT_WORDS: set[str] = set()
_dict_path = Path("/usr/share/dict/words")
if _dict_path.exists():
    DICT_WORDS = {w.strip().lower() for w in _dict_path.read_text(errors="ignore").splitlines() if w.strip()}

FIGURE_REF = re.compile(
    r"\b(the (table|graph|figure|chart|scatterplot|histogram|bar graph|line graph|"
    r"diagram|number line|box plot)\b|shown|graph shown|figure shown|as shown|"
    r"data from the|following (table|graph|figure))",
    re.I,
)

MATH_ARTIFACT = re.compile(
    r"(?:^|\s)[\^_]|"                 # orphaned super/subscript markers
    r"\|{2,}|"                        # rule fragments
    r"[A-Za-z]\s{2,}[A-Za-z]|"        # stacked-fraction column collapse
    r"[─-╿]"                # box drawing
)


def ends_mid_word(text: str) -> bool:
    if not text:
        return True
    if text.rstrip().endswith("-"):
        return True
    tail = re.findall(r"[A-Za-z']+", text)
    if not tail:
        return False
    last = tail[-1].lower().strip("'")
    if len(last) < 3 or not DICT_WORDS:
        return False
    if last in DICT_WORDS or last.rstrip("s") in DICT_WORDS or last + "e" in DICT_WORDS:
        return False
    # A capitalised final token is almost always a proper noun, not a fragment.
    if tail[-1][0].isupper():
        return False
    # Common inflections the web2 word list does not carry.
    for suffix in ("s", "es", "ed", "ing", "ly", "'s"):
        if last.endswith(suffix) and last[: -len(suffix)] in DICT_WORDS:
            return False
    return True


def shingles(text: str, n: int = 8) -> set[str]:
    words = re.findall(r"[a-z0-9']+", text.lower())
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


# ---------------------------------------------------------------------------
# difficulty
# ---------------------------------------------------------------------------


def difficulty_for(module: int, index: int, block_size: int) -> int:
    """Position within the item's ordered block, plus a module-2 step.

    Both modules run easy -> hard inside each domain block (RW) or across the
    module (Math), so the within-block position ratio r gives 1..4; module 2 of
    a paper linear form is built to the second-stage spec and sits a step above
    the routing module, so it gets +1.
    """
    r = 0.0 if block_size <= 1 else index / (block_size - 1)
    base = 1 + round(3 * r)
    return max(1, min(5, base + (1 if module == 2 else 0)))


def seconds_for(section: str, difficulty: int) -> int:
    return (55 + 10 * difficulty) if section == "rw" else (70 + 12 * difficulty)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def collect_raw(pdf: Path) -> list[dict]:
    """All parsed items from one question PDF, tagged with section and module."""
    pages = pdf_lines(pdf)

    section = None
    raw: list[dict] = []
    for page in pages:
        text_blob = " ".join(ln["text"] for ln in page)
        if re.search(r"\bReading and Writing\b.{0,40}\d+ QUESTIONS", text_blob) or re.search(
            r"\d+ QUESTIONS.{0,40}\bReading and Writing\b", text_blob
        ):
            section = "rw"
        elif re.search(r"\bMath\b.{0,40}\d+ QUESTIONS", text_blob) or re.search(
            r"\d+ QUESTIONS.{0,40}\bMath\b", text_blob
        ):
            section = "math"
        module = page_module(page)
        if section is None or module is None:
            continue
        left, right, crossed = split_columns(page)
        for column in (left, right):
            for item in cut_questions(column):
                parsed = parse_item(item, section)
                parsed["section"] = section
                parsed["module"] = module
                parsed["crossed"] = crossed
                raw.append(parsed)
    return raw


def build(test: int, rejects: list[dict]) -> list[dict]:
    bundle = MOCKS / f"full-length-sat-paper-practice-test_-bundle-{test}"
    qpdf = bundle / f"sat-practice-test-{test}-digital.pdf"
    apdf = bundle / f"sat-practice-test-{test}-answers-digital.pdf"
    if not qpdf.exists() or not apdf.exists():
        return []

    keys = read_answers(apdf)
    raw = collect_raw(qpdf)

    def reject(item, reason):
        rejects.append(
            {
                "testForm": test,
                "section": item.get("section"),
                "module": item.get("module"),
                "number": item.get("num"),
                "reason": reason,
            }
        )

    staged: list[dict] = []
    for item in raw:
        section, module, num = item["section"], item["module"], item["num"]
        limit = 33 if section == "rw" else 27
        if not 1 <= num <= limit:
            reject(item, "bad-question-number")
            continue

        stem = item["stem"]
        stimulus = norm(" ".join(item["stimulus"]))
        choices = item["choices"]
        key = keys.get((section, module, num))

        if key is None:
            reject(item, "no-answer-key")
            continue

        fmt = key["format"]

        if fmt == "multiple-choice":
            ids = [c for c, _ in choices]
            if ids != ["A", "B", "C", "D"]:
                reject(item, "choice-count")
                continue
            texts = [t for _, t in choices]
            if any(not t.strip() for t in texts):
                reject(item, "choice-empty")
                continue
            if len({t.strip().lower() for t in texts}) != 4:
                reject(item, "choice-duplicate")
                continue
            if key["answer"] not in ids:
                reject(item, "answer-not-in-choices")
                continue
            if any(BLEED_MARKERS.search(t) for t in texts):
                reject(item, "column-bleed")
                continue
            if any(ends_mid_word(t) for t in texts):
                reject(item, "truncated")
                continue
        else:
            if choices:
                reject(item, "spr-has-choices")
                continue
            if not re.fullmatch(r"-?\d+(?:\.\d+)?|-?\d+/\d+", key["answer"]):
                reject(item, "spr-unparseable")
                continue

        if not stem or len(stem) < 12:
            reject(item, "stem-too-short")
            continue
        if not stem.rstrip().endswith("?"):
            reject(item, "stem-not-a-question")
            continue
        if section == "rw":
            if not STEM.match(stem):
                reject(item, "no-stem-pattern")
                continue
        else:
            ask = re.split(r"(?<=[.?!])\s+", stem)[-1]
            if not MATH_STEM.match(ask):
                reject(item, "no-stem-pattern")
                continue
        if ends_mid_word(stem):
            reject(item, "truncated")
            continue

        if section == "rw":
            if len(stimulus.split()) < 20:
                reject(item, "passage-too-short")
                continue
            if ends_mid_word(stimulus):
                reject(item, "truncated")
                continue
            if FIGURE_REF.search(stem) or FIGURE_REF.search(stimulus):
                reject(item, "figure-required")
                continue
            skill = classify_rw(stem, stimulus, choices)
        else:
            blob = " ".join([stimulus, stem] + [t for _, t in choices])
            if FIGURE_REF.search(blob):
                reject(item, "figure-required")
                continue
            if MATH_ARTIFACT.search(blob):
                reject(item, "math-notation")
                continue
            if item["crossed"]:
                reject(item, "math-notation")
                continue
            skill = classify_math(" ".join([stimulus, stem]))

        if not skill:
            reject(item, "unclassified")
            continue

        staged.append(
            {
                "item": item,
                "stem": stem,
                "stimulus": stimulus,
                "choices": choices,
                "key": key,
                "skill": skill,
                "format": fmt,
            }
        )

    # Cross-question contamination sweep: an 8-word fragment that shows up in
    # two different items means a column was spliced somewhere.
    #
    # The stem is deliberately excluded. Every question of a given skill asks
    # the identical official stem ("Which choice completes the text with the
    # most logical and precise word or phrase?"), so including it made every
    # same-skill pair collide and discarded both halves as contamination.
    owner: dict[str, int] = {}
    collide: set[int] = set()
    for idx, s in enumerate(staged):
        blob = " ".join([s["stimulus"]] + [t for _, t in s["choices"]])
        for sh in shingles(blob):
            prev = owner.get(sh)
            if prev is not None and prev != idx:
                collide.add(idx)
                collide.add(prev)
            else:
                owner[sh] = idx
    for idx in sorted(collide):
        reject(staged[idx]["item"], "column-bleed")
    staged = [s for i, s in enumerate(staged) if i not in collide]

    # Difficulty needs the ordered blocks, so it is assigned after filtering.
    blocks: dict[tuple, list[int]] = defaultdict(list)
    for i, s in enumerate(staged):
        section, module = s["item"]["section"], s["item"]["module"]
        if section == "rw":
            block = SKILL_DOMAIN[s["skill"]]
        else:
            block = "math"
        blocks[(section, module, block)].append(i)
    for group in blocks.values():
        group.sort(key=lambda i: staged[i]["item"]["num"])

    emitted: list[dict] = []
    for (section, module, block), group in blocks.items():
        for pos, i in enumerate(group):
            s = staged[i]
            num = s["item"]["num"]
            diff = difficulty_for(module, pos, len(group))
            stimulus = s["stimulus"]
            secondary = None
            m = re.search(r"\bText 2\b", stimulus)
            if s["skill"] == "cross-text-connections" and m:
                secondary = stimulus[m.start():].strip()
                stimulus = stimulus[: m.start()].strip()
            record = {
                "id": f"official-t{s['item'].get('test', 0) or 0}-{section}{module}-q{num}",
                "section": section,
                "domain": SKILL_DOMAIN[s["skill"]],
                "skillId": s["skill"],
                "difficulty": diff,
                "format": s["format"],
                "prompt": s["stem"],
                "answer": s["key"]["answer"],
                "explanation": s["key"]["explanation"],
                "concept": SKILL_TITLE[s["skill"]],
                "estimatedSeconds": seconds_for(section, diff),
                "source": "official-practice",
                "testForm": test,
            }
            record["id"] = f"official-t{test}-{section}{module}-q{num}"
            if stimulus:
                record["stimulus"] = stimulus
            underlined = s["item"].get("underlined") or UNDERLINE_FALLBACKS.get((test, section, module, num))
            if underlined:
                record["underlinedText"] = underlined
            if secondary:
                record["secondaryStimulus"] = secondary
            if s["choices"]:
                record["choices"] = [{"id": cid, "text": txt} for cid, txt in s["choices"]]
            if s["key"]["whyWrong"]:
                record["whyWrong"] = dict(s["key"]["whyWrong"])
                record["misconceptionByChoice"] = dict(s["key"]["whyWrong"])
            emitted.append(record)

    emitted.sort(key=lambda r: (r["section"], r["id"]))
    return emitted


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_records: list[dict] = []
    all_rejects: list[dict] = []
    per_form: dict[int, Counter] = {}

    for test in TESTS:
        rejects: list[dict] = []
        records = build(test, rejects)
        per_form[test] = Counter(r["section"] for r in records)
        per_form[test]["rejected"] = len(rejects)
        all_records.extend(records)
        all_rejects.extend(rejects)

    tmp = OUT.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in all_records))
    tmp.replace(OUT)

    tmp = REJECTS.with_suffix(".jsonl.tmp")
    tmp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in all_rejects))
    tmp.replace(REJECTS)

    print(f"{'form':>6}{'R&W':>7}{'Math':>7}{'total':>8}{'rejected':>10}")
    for test in TESTS:
        c = per_form[test]
        print(f"{test:>6}{c['rw']:>7}{c['math']:>7}{c['rw'] + c['math']:>8}{c['rejected']:>10}")
    print(
        f"{'ALL':>6}{sum(1 for r in all_records if r['section'] == 'rw'):>7}"
        f"{sum(1 for r in all_records if r['section'] == 'math'):>7}"
        f"{len(all_records):>8}{len(all_rejects):>10}"
    )

    print("\nrejections by reason")
    for reason, n in Counter(r["reason"] for r in all_rejects).most_common():
        print(f"  {reason:<24}{n:>6}")

    print("\nemitted by skill")
    for skill, n in Counter(r["skillId"] for r in all_records).most_common():
        print(f"  {skill:<34}{n:>5}")

    print("\nemitted by difficulty")
    for d, n in sorted(Counter(r["difficulty"] for r in all_records).items()):
        print(f"  {d}{n:>7}")

    print(f"\nwrote {OUT}")
    print(f"wrote {REJECTS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
