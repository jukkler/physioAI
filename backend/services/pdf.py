import os
from datetime import datetime
from fpdf import FPDF


def _find_font() -> str | None:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def generate_pdf(result: dict) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    font_path = _find_font()
    if font_path:
        pdf.add_font("DocFont", "", font_path)
        bold_path = font_path.replace("DejaVuSans.ttf", "DejaVuSans-Bold.ttf").replace("arial.ttf", "arialbd.ttf")
        if os.path.isfile(bold_path):
            pdf.add_font("DocFont", "B", bold_path)
        else:
            pdf.add_font("DocFont", "B", font_path)
        font_name = "DocFont"
    else:
        font_name = "Helvetica"

    pdf.set_font(font_name, "B", 18)
    pdf.cell(0, 12, "PhysioDoc", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font(font_name, "", 10)
    pdf.set_text_color(120, 120, 120)
    ts = result.get("timestamp", "")
    try:
        dt = datetime.fromisoformat(ts)
        date_str = dt.strftime("%d.%m.%Y %H:%M")
    except (ValueError, TypeError):
        date_str = ts
    duration = result.get("duration_seconds", 0)
    dur_min = int(duration // 60)
    dur_sec = int(duration % 60)
    pdf.cell(0, 6, f"Datum: {date_str}  |  Dauer: {dur_min}:{dur_sec:02d} min", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    pdf.set_text_color(0, 0, 0)
    summary = result.get("summary", "")
    for line in summary.split("\n"):
        stripped = line.strip()
        if stripped.startswith("## "):
            pdf.ln(4)
            pdf.set_font(font_name, "B", 13)
            pdf.cell(0, 8, stripped[3:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
            pdf.set_font(font_name, "", 10)
        elif stripped.startswith("# "):
            pdf.set_font(font_name, "B", 15)
            pdf.cell(0, 10, stripped[2:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font(font_name, "", 10)
        elif stripped.startswith("- "):
            pdf.cell(6)
            pdf.multi_cell(0, 5, f"\u2022 {stripped[2:]}", new_x="LMARGIN", new_y="NEXT")
        elif stripped:
            pdf.multi_cell(0, 5, stripped, new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.ln(2)

    return bytes(pdf.output())
