from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


OUTPUT_PDF = Path(
    "/Users/bilolbekrayimov/games/IBM_hackathon/deliverables/bob-mcp-presentation-brief.pdf"
)

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 72
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

INK = colors.HexColor("#0B2545")
BLUE = colors.HexColor("#2E74B5")
DARK_BLUE = colors.HexColor("#1F4D78")
TEXT = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#667085")
LINE = colors.HexColor("#D7DEE8")
PAGE_FILL = colors.HexColor("#FCFCFD")
BOX = colors.HexColor("#F4F7FB")
BOX_ALT = colors.HexColor("#EEF4FA")
BOX_LIGHT = colors.HexColor("#F7F9FC")


styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.2,
    leading=12,
    textColor=TEXT,
    spaceAfter=0,
)
CARD_TITLE = ParagraphStyle(
    "CardTitle",
    parent=styles["BodyText"],
    fontName="Helvetica-Bold",
    fontSize=10.5,
    leading=12,
    textColor=DARK_BLUE,
    spaceAfter=0,
)
META = ParagraphStyle(
    "Meta",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9,
    leading=11,
    textColor=TEXT,
    spaceAfter=0,
)
SUBTITLE = ParagraphStyle(
    "Subtitle",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=11,
    leading=14,
    textColor=MUTED,
    spaceAfter=0,
)
QUOTE = ParagraphStyle(
    "Quote",
    parent=styles["BodyText"],
    fontName="Helvetica-Oblique",
    fontSize=10,
    leading=13,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=0,
)
BOX_TEXT = ParagraphStyle(
    "BoxText",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=10,
    leading=13,
    textColor=TEXT,
    spaceAfter=0,
)


POINTS = [
    (
        "1. Bob stays in charge",
        "Bob still chooses the tools, the path, and the final recommendation. The experience stays human-centered instead of becoming a black-box script."
    ),
    (
        "2. Bob gets repo-wide x-ray vision",
        "The MCP looks across runtime pins, lockfiles, CI, Docker, deployment config, and risky source patterns, so Bob misses fewer hidden blockers."
    ),
    (
        "3. Bob gets repeatable evidence",
        "Findings come back as typed issues, evidence, and validation steps. That makes the recommendation easier to trust, review, and reuse."
    ),
    (
        "4. Bob can justify direct vs staged",
        "The MCP compares upgrade paths with explicit risk and effort scoring. Bob can explain why the safer or faster route wins for this repo."
    ),
    (
        "5. Bob creates durable artifacts",
        "The output is more than chat: decision, evidence, tool trace, execution plan, and validation checklist become a shareable modernization report."
    ),
    (
        "6. This is safe augmentation",
        "The MCP inspects and recommends without silently changing the analyzed repo. It feels like instrumentation, not takeover."
    ),
]


def draw_paragraph(c: canvas.Canvas, text: str, style: ParagraphStyle, x: float, y_top: float, width: float) -> float:
    paragraph = Paragraph(text, style)
    w, h = paragraph.wrap(width, 1000)
    paragraph.drawOn(c, x, y_top - h)
    return h


def draw_card(c: canvas.Canvas, x: float, y_top: float, width: float, height: float, title: str, body: str, fill_color) -> None:
    c.setFillColor(fill_color)
    c.roundRect(x, y_top - height, width, height, 8, stroke=0, fill=1)
    c.setStrokeColor(LINE)
    c.roundRect(x, y_top - height, width, height, 8, stroke=1, fill=0)

    inner_x = x + 12
    inner_width = width - 24
    title_h = draw_paragraph(c, title, CARD_TITLE, inner_x, y_top - 12, inner_width)
    draw_paragraph(c, body, BODY, inner_x, y_top - 12 - title_h - 4, inner_width)


def build_pdf() -> Path:
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT_PDF), pagesize=letter)
    c.setTitle("Why This MCP Makes Bob Better")
    c.setAuthor("OpenAI Codex")
    c.setSubject("Presentation brief for design support")

    c.setFillColor(PAGE_FILL)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    y = PAGE_HEIGHT - MARGIN

    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, y, "Modernization Navigator | Presentation Brief")
    y -= 18

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(BLUE)
    c.drawString(MARGIN, y, "DESIGN SUPPORT BRIEF")
    y -= 24

    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "Why This MCP Makes Bob Better")
    y -= 20

    subtitle = (
        "A one-page framing brief to position the MCP as Bob augmentation, not Bob replacement."
    )
    subtitle_h = draw_paragraph(c, subtitle, SUBTITLE, MARGIN, y, CONTENT_WIDTH)
    y -= subtitle_h + 12

    meta_lines = [
        "<b>Audience:</b> Presentation design team",
        "<b>Objective:</b> Show that the MCP strengthens Bob’s judgment instead of taking Bob’s work away",
        "<b>Source basis:</b> Repo analysis plus passing build and test verification",
    ]
    for line in meta_lines:
        meta_h = draw_paragraph(c, line, META, MARGIN, y, CONTENT_WIDTH)
        y -= meta_h + 2

    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    y -= 8
    c.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y -= 18

    message_height = 62
    c.setFillColor(BOX)
    c.roundRect(MARGIN, y - message_height, CONTENT_WIDTH, message_height, 10, stroke=0, fill=1)
    c.setStrokeColor(LINE)
    c.roundRect(MARGIN, y - message_height, CONTENT_WIDTH, message_height, 10, stroke=1, fill=0)
    draw_paragraph(
        c,
        "<b>Core message:</b> This MCP does not do Bob’s job for him. It gives Bob repo-wide evidence, repeatable analysis, and durable outputs so Bob’s recommendations become faster, sharper, and more defensible.",
        BOX_TEXT,
        MARGIN + 14,
        y - 12,
        CONTENT_WIDTH - 28,
    )
    y -= message_height + 18

    c.setFont("Helvetica-Bold", 15)
    c.setFillColor(BLUE)
    c.drawString(MARGIN, y, "Strong Points Designers Can Build Around")
    y -= 18

    gutter = 14
    col_width = (CONTENT_WIDTH - gutter) / 2
    card_height = 76
    row_gap = 10

    left_x = MARGIN
    right_x = MARGIN + col_width + gutter

    for row in range(3):
        left_title, left_body = POINTS[row]
        right_title, right_body = POINTS[row + 3]
        fill_left = BOX_ALT if row % 2 == 0 else BOX_LIGHT
        fill_right = BOX_LIGHT if row % 2 == 0 else BOX_ALT
        draw_card(c, left_x, y, col_width, card_height, left_title, left_body, fill_left)
        draw_card(c, right_x, y, col_width, card_height, right_title, right_body, fill_right)
        y -= card_height + row_gap

    direction_height = 118
    c.setFillColor(BOX)
    c.roundRect(MARGIN, y - direction_height, CONTENT_WIDTH, direction_height, 10, stroke=0, fill=1)
    c.setStrokeColor(LINE)
    c.roundRect(MARGIN, y - direction_height, CONTENT_WIDTH, direction_height, 10, stroke=1, fill=0)

    draw_paragraph(c, "<b>Design Direction</b>", CARD_TITLE, MARGIN + 14, y - 12, CONTENT_WIDTH - 28)

    col_gap = 12
    section_top = y - 30
    small_col_width = (CONTENT_WIDTH - 28 - 2 * col_gap) / 3
    sx = MARGIN + 14

    draw_paragraph(
        c,
        "<b>Emphasize</b><br/>Bob with x-ray vision<br/>Evidence-backed judgment<br/>Reusable modernization artifact",
        BODY,
        sx,
        section_top,
        small_col_width,
    )
    draw_paragraph(
        c,
        "<b>Show</b><br/>User -> Bob -> MCP tools -> evidence -> report -> Bob recommendation<br/>Bob still centered in the flow",
        BODY,
        sx + small_col_width + col_gap,
        section_top,
        small_col_width,
    )
    draw_paragraph(
        c,
        "<b>Avoid</b><br/>Autonomous robot imagery<br/>Black-box AI magic<br/>Messaging that implies Bob is being replaced",
        BODY,
        sx + 2 * (small_col_width + col_gap),
        section_top,
        small_col_width,
    )

    y -= direction_height + 16

    quote_h = draw_paragraph(
        c,
        "“Bob stays the strategist; the MCP supplies the instrumentation.”",
        QUOTE,
        MARGIN,
        y,
        CONTENT_WIDTH,
    )
    y -= quote_h + 8

    draw_paragraph(
        c,
        "<b>Verification note:</b> This brief is grounded in a full repository review. The project build passed and the automated test suite passed at the time of analysis.",
        META,
        MARGIN,
        y,
        CONTENT_WIDTH,
    )

    c.save()
    return OUTPUT_PDF


if __name__ == "__main__":
    path = build_pdf()
    print(path)
