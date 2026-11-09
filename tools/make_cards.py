"""SongScan card generator: one CSV -> decks/<deck>.json + print/cards-<deck>.pdf.

    python tools/make_cards.py songs/main.csv            # deck name = file name
    python tools/make_cards.py songs/x.csv --deck main   # explicit deck name

CSV columns: card,title,artist,year,spotify
- spotify takes a track share link, a spotify:track: URI or a bare 22-char ID.
- Blank card numbers are assigned (next free number) and WRITTEN BACK to the CSV,
  so a later run can never renumber an already-printed card.
- Any error (duplicate card, missing or malformed Spotify ID, missing
  title/artist/year, unprintable character) stops the run before anything is written.

PDF layout: A4, 3x4 grid of 60 mm cards. Every fronts page is followed by its
backs page with columns mirrored, for duplex printing flipped on the LONG edge.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

import pymupdf  # PyMuPDF
import qrcode
from qrcode.constants import ERROR_CORRECT_Q

ROOT = Path(__file__).resolve().parent.parent
COLUMNS = ["card", "title", "artist", "year", "spotify"]

MM = 72 / 25.4
CARD = 60 * MM
COLS, ROWS = 3, 4
PAGE = pymupdf.paper_rect("a4")
X0 = (PAGE.width - COLS * CARD) / 2
Y0 = (PAGE.height - ROWS * CARD) / 2

FONT_CANDIDATES = [  # (regular, bold); first pair that exists wins
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/Library/Fonts/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf"),
]

SPOTIFY_ID = re.compile(r"^[0-9A-Za-z]{22}$")
DECK_NAME = re.compile(r"^[a-z0-9]+$")


class CardError(Exception):
    pass


def spotify_id(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        raise CardError("spotify is empty")
    m = (re.match(r"^spotify:track:([^:?#/\s]+)$", raw)
         or re.match(r"^https?://open\.spotify\.com/(?:intl-[a-z-]+/)?track/([^/?#\s]+)", raw))
    cand = m.group(1) if m else raw
    if not SPOTIFY_ID.match(cand):
        raise CardError(f"spotify: not a track link or 22-char track ID: {raw!r}")
    return cand


def read_rows(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = [h.strip().lower() for h in (reader.fieldnames or [])]
        missing = [c for c in COLUMNS if c not in header]
        if missing:
            raise SystemExit(f"ERROR {path}: missing column(s) {missing}; expected {COLUMNS}")
        reader.fieldnames = header
        rows = []
        for line_no, row in enumerate(reader, start=2):
            row = {k: (v or "").strip() for k, v in row.items() if k}
            if not any(row.values()):
                continue  # blank line
            row["_line"] = line_no
            rows.append(row)
    return rows


def normalize(rows: list[dict], glyph_ok) -> tuple[list[dict], list[str], bool]:
    """Returns (cards, errors, numbers_assigned). Never writes anything."""
    errors: list[str] = []
    seen: dict[str, int] = {}
    for row in rows:
        where = f"line {row['_line']}"
        c = row["card"]
        if c:
            if not re.fullmatch(r"\d{1,4}", c) or int(c) == 0:
                errors.append(f"{where}: card must be 1-9999, got {c!r}")
            else:
                c = c.zfill(4)
                if c in seen:
                    errors.append(f"{where}: duplicate card {c} (also on line {seen[c]})")
                seen[c] = row["_line"]
                row["card"] = c
        try:
            row["spotify"] = spotify_id(row["spotify"])
        except CardError as e:
            errors.append(f"{where}: {e}")
        for col in ("title", "artist", "year"):
            if not row[col]:
                errors.append(f"{where}: {col} is empty")
            bad = sorted({ch for ch in row[col] if not glyph_ok(ch)})
            if bad:
                errors.append(f"{where}: {col} has characters the card font cannot print: {bad}")
        if row["year"] and not re.fullmatch(r"\d{4}", row["year"]):
            errors.append(f"{where}: year must be 4 digits, got {row['year']!r}")

    assigned = False
    next_free = max((int(c) for c in seen), default=0) + 1
    for row in rows:
        if not row["card"]:
            if next_free > 9999:
                errors.append(f"line {row['_line']}: no card numbers left")
                continue
            row["card"] = f"{next_free:04d}"
            next_free += 1
            assigned = True
    return rows, errors, assigned


def write_csv_back(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow(row)


def deck_json(deck: str, rows: list[dict]) -> str:
    cards = {row["card"]: {"spotify": row["spotify"]} for row in sorted(rows, key=lambda r: r["card"])}
    return json.dumps({"format": 1, "deck": deck, "cards": cards}, indent=2) + "\n"


def qr_png(text: str) -> bytes:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_Q, box_size=12, border=0)
    qr.add_data(text)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    return buf.getvalue()


def cell(col: int, row: int) -> pymupdf.Rect:
    x, y = X0 + col * CARD, Y0 + row * CARD
    return pymupdf.Rect(x, y, x + CARD, y + CARD)


def crop_marks(page: pymupdf.Page) -> None:
    grey, tick = (0.55, 0.55, 0.55), 6 * MM
    for i in range(COLS + 1):
        x = X0 + i * CARD
        page.draw_line((x, Y0 - tick - 2), (x, Y0 - 2), color=grey, width=0.4)
        page.draw_line((x, Y0 + ROWS * CARD + 2), (x, Y0 + ROWS * CARD + tick + 2), color=grey, width=0.4)
    for j in range(ROWS + 1):
        y = Y0 + j * CARD
        page.draw_line((X0 - tick - 2, y), (X0 - 2, y), color=grey, width=0.4)
        page.draw_line((X0 + COLS * CARD + 2, y), (X0 + COLS * CARD + tick + 2, y), color=grey, width=0.4)


def fit_text(page, rect, text, size, fontname, fontfile, min_size=7.0) -> None:
    while size >= min_size:
        rc = page.insert_textbox(rect, text, fontsize=size, fontname=fontname,
                                 fontfile=fontfile, align=pymupdf.TEXT_ALIGN_CENTER)
        if rc >= 0:
            return
        size -= 0.5
    raise CardError(f"text does not fit on a card even at {min_size}pt: {text!r}")


def write_pdf(deck: str, rows: list[dict], fonts: tuple[str, str]) -> bytes:
    regular, bold = fonts
    doc = pymupdf.open()
    per_sheet = COLS * ROWS
    rows = sorted(rows, key=lambda r: r["card"])
    for start in range(0, len(rows), per_sheet):
        batch = rows[start:start + per_sheet]
        # PyMuPDF 1.27 orphans earlier Page objects on new_page(): create both, then re-fetch.
        doc.new_page(width=PAGE.width, height=PAGE.height)
        doc.new_page(width=PAGE.width, height=PAGE.height)
        front, back = doc[-2], doc[-1]
        for p in (front, back):
            crop_marks(p)
        for i, row in enumerate(batch):
            c, r = i % COLS, i // COLS
            # Front: QR + card number.
            f = cell(c, r)
            q = 42 * MM
            qx, qy = f.x0 + (CARD - q) / 2, f.y0 + 6 * MM
            front.insert_image(pymupdf.Rect(qx, qy, qx + q, qy + q),
                               stream=qr_png(f"qs1:deck={deck};card={row['card']}"))
            front.insert_textbox(pymupdf.Rect(f.x0, f.y0 + 50 * MM, f.x1, f.y1 - 2 * MM),
                                 f"{deck} · {row['card']}", fontsize=8, fontname="arial",
                                 fontfile=regular, align=pymupdf.TEXT_ALIGN_CENTER)
            # Back: mirrored column so it lands behind its front on a long-edge flip.
            b = cell(COLS - 1 - c, r)
            pad = 5 * MM
            fit_text(back, pymupdf.Rect(b.x0 + pad, b.y0 + 7 * MM, b.x1 - pad, b.y0 + 25 * MM),
                     row["year"], 40, "arialbd", bold)
            fit_text(back, pymupdf.Rect(b.x0 + pad, b.y0 + 27 * MM, b.x1 - pad, b.y0 + 44 * MM),
                     row["title"], 13, "arialbd", bold)
            fit_text(back, pymupdf.Rect(b.x0 + pad, b.y0 + 45 * MM, b.x1 - pad, b.y1 - 4 * MM),
                     row["artist"], 11, "arial", regular)
    return doc.tobytes(garbage=3, deflate=True)


def find_fonts() -> tuple[str, str]:
    for reg, bold in FONT_CANDIDATES:
        if Path(reg).exists() and Path(bold).exists():
            return reg, bold
    raise SystemExit("ERROR: no card font found; add a (regular, bold) TTF pair to FONT_CANDIDATES")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path)
    ap.add_argument("--deck", help="deck name (lowercase letters/digits); default: CSV file name")
    args = ap.parse_args()

    deck = args.deck or args.csv.stem.lower()
    if not DECK_NAME.match(deck):
        raise SystemExit(f"ERROR: deck name must be lowercase letters and digits, got {deck!r}")

    fonts = find_fonts()
    font_r, font_b = pymupdf.Font(fontfile=fonts[0]), pymupdf.Font(fontfile=fonts[1])
    glyph_ok = lambda ch: ch.isspace() or (font_r.has_glyph(ord(ch)) and font_b.has_glyph(ord(ch)))

    rows = read_rows(args.csv)
    if not rows:
        raise SystemExit(f"ERROR {args.csv}: no cards")
    rows, errors, assigned = normalize(rows, glyph_ok)
    if errors:
        print(f"ERROR {args.csv}: {len(errors)} problem(s), nothing written:", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1

    # Build everything in memory first so a late failure still writes nothing.
    try:
        pdf = write_pdf(deck, rows, fonts)
    except CardError as e:
        print(f"ERROR {args.csv}: {e}; nothing written", file=sys.stderr)
        return 1
    js = deck_json(deck, rows)

    json_path = ROOT / "decks" / f"{deck}.json"
    pdf_path = ROOT / "print" / f"cards-{deck}.pdf"
    json_path.parent.mkdir(exist_ok=True)
    pdf_path.parent.mkdir(exist_ok=True)
    if assigned:
        write_csv_back(args.csv, rows)
        print(f"Assigned card numbers to blank rows and saved them in {args.csv}")
    json_path.write_text(js, encoding="utf-8", newline="\n")
    pdf_path.write_bytes(pdf)

    sheets = -(-len(rows) // (COLS * ROWS))
    print(f"{len(rows)} cards -> {json_path.relative_to(ROOT)} and {pdf_path.relative_to(ROOT)} "
          f"({sheets} sheet(s), {2 * sheets} pages; print duplex, flip on LONG edge)")

    by_id: dict[str, list[str]] = {}
    for r in rows:
        by_id.setdefault(r["spotify"], []).append(r["card"])
    for sid, cards in by_id.items():
        if len(cards) > 1:
            print(f"Same Spotify song on cards {', '.join(cards)} ({sid})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
