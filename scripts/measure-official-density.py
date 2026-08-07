"""Measure official digital SAT Reading and Writing passage lengths.

The practice PDFs are two-column. pdftotext -layout keeps both columns on the
same physical line, so each line is split on a wide whitespace run and the
halves are reassembled into separate column streams before questions are cut.
"""
import re
import subprocess
import sys
import json
from pathlib import Path
from statistics import median

MOCKS = Path("/Users/tannmaybaid/Desktop/Claude Projects/SAT-learning/SAT Mocks")
WORK = Path("/private/tmp/claude-501/-Users/ab31d013-fc3e-4b14-81ea-b84ec64becf7/scratchpad/pdftext")
WORK.mkdir(exist_ok=True)

NOISE = re.compile(
    r"Unauthorized copying|CO ?NTI ?N ?U ?E|^Module$|^Reading and Writing$|"
    r"^\d+ QUESTIONS$|^DIRECTIONS$|The questions in this section address|"
    r"question includes one or more passages|and question carefully|"
    r"All questions in this section are multiple-choice|single best answer|"
    r"^STOP$|^Math$|reference sheet|^Turn to Section|practice test|sat\.org",
    re.I,
)

# The question stem always begins with one of these openers on the digital SAT.
STEM = re.compile(
    r"^(Which choice|Which finding|Which quotation|Which statement|What does the text|"
    r"According to the text|Based on the text|As used in the text|The student wants|"
    r"Which of the following|What is the main|Which sentence|Complete the text)",
    re.I,
)
CHOICE = re.compile(r"^[A-D]\)")
QNUM = re.compile(r"^\s{0,6}(\d{1,2})\s*$")


def pdf_lines(pdf: Path) -> list[str]:
    out = WORK / (pdf.stem + ".txt")
    if not out.exists():
        subprocess.run(["pdftotext", "-layout", str(pdf), str(out)], check=True)
    return out.read_text(errors="ignore").splitlines()


def split_columns(lines: list[str]) -> list[str]:
    """Return left-column stream followed by right-column stream, per page."""
    pages = []
    current = []
    for line in lines:
        if "\f" in line:
            parts = line.split("\f")
            current.append(parts[0])
            pages.append(current)
            current = [parts[-1]] if parts[-1].strip() else []
        else:
            current.append(line)
    pages.append(current)

    stream = []
    for page in pages:
        left, right = [], []
        for line in page:
            if not line.strip():
                left.append("")
                right.append("")
                continue
            # A wide gap (10+ spaces) after some content marks the column break.
            m = re.search(r"\S\s{10,}(?=\S)", line)
            if m:
                left.append(line[: m.end()])
                right.append(line[m.end():])
            elif len(line) - len(line.lstrip()) > 70:
                left.append("")
                right.append(line)
            else:
                left.append(line)
                right.append("")
        stream.extend(left)
        stream.append("@@COL@@")
        stream.extend(right)
    return stream


def clean(lines):
    for raw in lines:
        text = raw.strip()
        if not text or text == "@@COL@@":
            yield text
            continue
        if NOISE.search(text):
            yield ""
            continue
        yield text


def questions(stream):
    """Cut the stream into (passage_words, has_stem) per numbered question."""
    items = []
    buf = None
    for line in clean(stream):
        m = QNUM.match(line) if line else None
        if m and (buf is None or buf["passage"] or buf["stem"]):
            if buf:
                items.append(buf)
            buf = {"num": int(m.group(1)), "passage": [], "stem": [], "choices": []}
            continue
        if buf is None:
            continue
        if CHOICE.match(line):
            buf["choices"].append(line)
        elif STEM.match(line) or buf["stem"]:
            if not buf["choices"]:
                buf["stem"].append(line)
        elif not buf["choices"]:
            buf["passage"].append(line)
    if buf:
        items.append(buf)
    return [q for q in items if q["stem"] and len(q["choices"]) >= 4]


def words(parts):
    return len(" ".join(parts).split())


def classify(q):
    stem = re.sub(r"\s+", " ", " ".join(q["stem"])).lower()
    passage = re.sub(r"\s+", " ", " ".join(q["passage"])).lower()
    if "text 1" in passage and "text 2" in passage:
        return "cross-text-connections"
    if "conforms to the conventions of standard english" in stem:
        return "standard-english"
    if "most logical transition" in stem:
        return "transitions"
    if "student wants to" in stem or "from the notes to accomplish" in stem:
        return "rhetorical-synthesis"
    if "most logical and precise word" in stem or "most nearly mean" in stem:
        return "words-in-context"
    if "most logically completes the text" in stem:
        return "inferences"
    if "data from the table" in stem or "data from the graph" in stem or "uses data from" in stem or "appropriate linear model" in stem or "graphs shows the most appropriate model" in stem:
        return "command-evidence-quantitative"
    if "quotation from" in stem or "which finding" in stem or "most effectively illustrates" in stem or "most strongly support" in stem or "most directly support" in stem or "most directly weaken" in stem:
        return "command-evidence-textual"
    if "overall structure of the text" in stem or "function of the underlined" in stem or "function of the underlined portion" in stem or "overall purpose of the text" in stem or "best states the function" in stem:
        return "text-structure-purpose"
    if ("main idea" in stem or "according to the text" in stem or "based on the text" in stem
            or "most strongly supported by the text" in stem or "best describes" in stem):
        return "central-ideas-details"
    return "other"


def main():
    buckets = {}
    total = 0
    for bundle in sorted(MOCKS.iterdir()):
        if not bundle.is_dir():
            continue
        pdf = next((p for p in bundle.glob("*-digital.pdf") if "answer" not in p.name and "scoring" not in p.name), None)
        if not pdf:
            continue
        qs = questions(split_columns(pdf_lines(pdf)))
        total += len(qs)
        for q in qs:
            w = words(q["passage"])
            if w < 5:
                continue
            buckets.setdefault(classify(q), []).append(w)

    print(f"questions parsed: {total}\n")
    print(f"{'type':<32}{'n':>5}{'p10':>7}{'med':>7}{'p75':>7}{'p90':>7}{'max':>7}")
    for name, values in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        v = sorted(values)
        pick = lambda p: v[min(len(v) - 1, int(len(v) * p))]
        print(f"{name:<32}{len(v):>5}{pick(0.1):>7}{int(median(v)):>7}{pick(0.75):>7}{pick(0.9):>7}{v[-1]:>7}")
    Path(WORK / "buckets.json").write_text(json.dumps(buckets))


if __name__ == "__main__":
    sys.exit(main())
