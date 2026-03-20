"""Table detection and extraction module.

Uses PyMuPDF line analysis to detect tables from horizontal/vertical lines.
"""

from __future__ import annotations

import logging

import fitz  # PyMuPDF

from app.pdf_converter.config import PipelineConfig
from app.pdf_converter.models import (
    BorderStyle, CellBorder, Color, ElementType, FontInfo, PageElement,
    Rect, TableCell, TableElement, TextBlock, TextLine, TextSpan,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PyMuPDF line-based detection (heuristic)
# ---------------------------------------------------------------------------

def _detect_tables_lines(
    fitz_page: fitz.Page,
    config: PipelineConfig,
) -> list[TableElement]:
    """Detect tables by analyzing horizontal/vertical lines (drawings)."""
    drawings = fitz_page.get_drawings()
    page_height = fitz_page.rect.height
    page_width = fitz_page.rect.width

    h_lines: list[tuple[float, float, float, float]] = []  # y, x0, x1, width
    v_lines: list[tuple[float, float, float, float]] = []  # x, y0, y1, width

    for path in drawings:
        for item in path.get("items", []):
            if item[0] == "l":  # line
                p1, p2 = item[1], item[2]
                x0, y0 = p1.x, p1.y
                x1, y1 = p2.x, p2.y
                line_width = path.get("width", 0.5)

                # Horizontal line
                if abs(y1 - y0) < 2 and abs(x1 - x0) > 20:
                    h_lines.append((
                        (y0 + y1) / 2,
                        min(x0, x1), max(x0, x1),
                        line_width,
                    ))
                # Vertical line
                elif abs(x1 - x0) < 2 and abs(y1 - y0) > 20:
                    v_lines.append((
                        (x0 + x1) / 2,
                        min(y0, y1), max(y0, y1),
                        line_width,
                    ))

            elif item[0] == "re":  # rectangle
                rect = item[1]
                if hasattr(rect, 'x0'):
                    rx0, ry0, rx1, ry1 = rect.x0, rect.y0, rect.x1, rect.y1
                else:
                    continue
                line_width = path.get("width", 0.5)

                # Thin rectangles are lines
                if abs(ry1 - ry0) < 3:  # horizontal
                    h_lines.append(((ry0 + ry1) / 2, rx0, rx1, line_width))
                elif abs(rx1 - rx0) < 3:  # vertical
                    v_lines.append(((rx0 + rx1) / 2, ry0, ry1, line_width))

    if len(h_lines) < 2 or len(v_lines) < 2:
        return []

    # Cluster lines into potential tables
    merge_dist = config.table.merge_close_lines

    h_lines.sort(key=lambda l: l[0])
    v_lines.sort(key=lambda l: l[0])

    h_groups = _cluster_values([l[0] for l in h_lines], merge_dist)
    v_groups = _cluster_values([l[0] for l in v_lines], merge_dist)

    if len(h_groups) < 2 or len(v_groups) < 2:
        return []

    # Build table from the grid
    row_ys = sorted(h_groups)
    col_xs = sorted(v_groups)

    table_bbox = Rect(
        min(col_xs) - 1, min(row_ys) - 1,
        max(col_xs) + 1, max(row_ys) + 1,
    )

    num_rows = len(row_ys) - 1
    num_cols = len(col_xs) - 1

    if num_rows < config.table.min_rows or num_cols < config.table.min_cols:
        return []

    cells: list[TableCell] = []
    col_widths = [col_xs[i + 1] - col_xs[i] for i in range(num_cols)]
    row_heights = [row_ys[i + 1] - row_ys[i] for i in range(num_rows)]

    for r_idx in range(num_rows):
        for c_idx in range(num_cols):
            cell_bbox = Rect(
                col_xs[c_idx], row_ys[r_idx],
                col_xs[c_idx + 1], row_ys[r_idx + 1],
            )

            content = _extract_cell_text(fitz_page, cell_bbox)

            borders = _detect_cell_borders(
                cell_bbox, h_lines, v_lines, merge_dist
            )

            cells.append(TableCell(
                content=content,
                bbox=cell_bbox,
                row_index=r_idx,
                col_index=c_idx,
                border_top=borders[0],
                border_bottom=borders[1],
                border_left=borders[2],
                border_right=borders[3],
            ))

    return [TableElement(
        cells=cells,
        bbox=table_bbox,
        num_rows=num_rows,
        num_cols=num_cols,
        col_widths=col_widths,
        row_heights=row_heights,
        has_header_row=True,
        detection_method="lattice",
        confidence=0.9,
    )]


def _cluster_values(values: list[float], tolerance: float) -> list[float]:
    """Cluster nearby values and return representative (mean) of each cluster."""
    if not values:
        return []

    sorted_vals = sorted(values)
    clusters: list[list[float]] = [[sorted_vals[0]]]

    for v in sorted_vals[1:]:
        if v - clusters[-1][-1] < tolerance:
            clusters[-1].append(v)
        else:
            clusters.append([v])

    return [sum(c) / len(c) for c in clusters]


def _detect_cell_borders(
    cell_bbox: Rect,
    h_lines: list[tuple[float, float, float, float]],
    v_lines: list[tuple[float, float, float, float]],
    tolerance: float,
) -> tuple[CellBorder, CellBorder, CellBorder, CellBorder]:
    """Detect border styles for a cell from nearby lines."""
    top = CellBorder(width=0, style=BorderStyle.NONE)
    bottom = CellBorder(width=0, style=BorderStyle.NONE)
    left = CellBorder(width=0, style=BorderStyle.NONE)
    right = CellBorder(width=0, style=BorderStyle.NONE)

    for y, x0, x1, w in h_lines:
        if abs(y - cell_bbox.y0) < tolerance and x0 <= cell_bbox.x1 and x1 >= cell_bbox.x0:
            top = CellBorder(width=w, style=BorderStyle.SOLID)
        if abs(y - cell_bbox.y1) < tolerance and x0 <= cell_bbox.x1 and x1 >= cell_bbox.x0:
            bottom = CellBorder(width=w, style=BorderStyle.SOLID)

    for x, y0, y1, w in v_lines:
        if abs(x - cell_bbox.x0) < tolerance and y0 <= cell_bbox.y1 and y1 >= cell_bbox.y0:
            left = CellBorder(width=w, style=BorderStyle.SOLID)
        if abs(x - cell_bbox.x1) < tolerance and y0 <= cell_bbox.y1 and y1 >= cell_bbox.y0:
            right = CellBorder(width=w, style=BorderStyle.SOLID)

    return (top, bottom, left, right)


# ---------------------------------------------------------------------------
# Cell text extraction helper
# ---------------------------------------------------------------------------

def _extract_cell_text(fitz_page: fitz.Page, cell_bbox: Rect) -> list[TextBlock]:
    """Extract text content within a cell region from the PDF page."""
    clip = fitz.Rect(cell_bbox.x0, cell_bbox.y0, cell_bbox.x1, cell_bbox.y1)

    blocks = fitz_page.get_text("dict", clip=clip,
                                  flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

    result: list[TextBlock] = []

    for block in blocks:
        if block.get("type") != 0:
            continue

        block_bbox = Rect(*block["bbox"])
        lines: list[TextLine] = []

        for line_data in block.get("lines", []):
            line_bbox = Rect(*line_data["bbox"])
            spans: list[TextSpan] = []

            for span_data in line_data.get("spans", []):
                text = span_data.get("text", "")
                if not text:
                    continue

                span_bbox = Rect(*span_data["bbox"])
                color_int = span_data.get("color", 0)
                r = ((color_int >> 16) & 0xFF) / 255.0
                g = ((color_int >> 8) & 0xFF) / 255.0
                b = (color_int & 0xFF) / 255.0

                flags = span_data.get("flags", 0)
                font_info = FontInfo(
                    name=span_data.get("font", "Arial"),
                    size=span_data.get("size", 10.0),
                    bold=bool(flags & 16),
                    italic=bool(flags & 2),
                    color=Color(r, g, b),
                )

                spans.append(TextSpan(
                    text=text,
                    font=font_info,
                    bbox=span_bbox,
                ))

            if spans:
                lines.append(TextLine(spans=spans, bbox=line_bbox))

        if lines:
            result.append(TextBlock(lines=lines, bbox=block_bbox))

    return result


# ---------------------------------------------------------------------------
# Merged cell detection (post-processing)
# ---------------------------------------------------------------------------

def _detect_merged_cells(table: TableElement) -> TableElement:
    """Post-process to detect merged/spanning cells."""
    if not table.cells:
        return table

    grid: dict[tuple[int, int], TableCell] = {}
    for cell in table.cells:
        grid[(cell.row_index, cell.col_index)] = cell

    for cell in table.cells:
        if cell.row_span > 1 or cell.col_span > 1:
            continue

        c = cell.col_index + 1
        while c < table.num_cols:
            neighbor = grid.get((cell.row_index, c))
            if neighbor and not neighbor.text.strip():
                if cell.border_right.style == BorderStyle.NONE:
                    cell.col_span += 1
                    c += 1
                else:
                    break
            else:
                break

        r = cell.row_index + 1
        while r < table.num_rows:
            neighbor = grid.get((r, cell.col_index))
            if neighbor and not neighbor.text.strip():
                if cell.border_bottom.style == BorderStyle.NONE:
                    cell.row_span += 1
                    r += 1
                else:
                    break
            else:
                break

    return table


# ---------------------------------------------------------------------------
# Background color detection for cells
# ---------------------------------------------------------------------------

def _detect_cell_backgrounds(
    table: TableElement,
    fitz_page: fitz.Page,
) -> TableElement:
    """Detect cell background colors from vector drawings on the page."""
    drawings = fitz_page.get_drawings()
    filled_rects: list[tuple[Rect, Color]] = []

    for path in drawings:
        fill = path.get("fill")
        if not fill:
            continue
        if isinstance(fill, (list, tuple)) and len(fill) >= 3:
            color = Color(fill[0], fill[1], fill[2])
            if color.r > 0.99 and color.g > 0.99 and color.b > 0.99:
                continue

            for item in path.get("items", []):
                if item[0] == "re":
                    rect = item[1]
                    if hasattr(rect, "x0"):
                        filled_rects.append((
                            Rect(rect.x0, rect.y0, rect.x1, rect.y1),
                            color,
                        ))

    for cell in table.cells:
        for rect, color in filled_rects:
            if rect.contains(cell.bbox) or (
                cell.bbox.intersection(rect) and
                cell.bbox.area > 0 and
                cell.bbox.intersection(rect).area / cell.bbox.area > 0.8
            ):
                cell.background_color = color
                break

    return table


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def detect_tables(
    fitz_page: fitz.Page,
    fitz_doc: fitz.Document,
    page_number: int,
    config: PipelineConfig,
    pdf_path: str = "",
) -> list[PageElement]:
    """Detect and extract all tables from a page using line analysis.

    Returns:
        List of PageElement wrapping TableElements
    """
    tables = _detect_tables_lines(fitz_page, config)

    # Post-processing
    for table in tables:
        _detect_merged_cells(table)
        _detect_cell_backgrounds(table, fitz_page)

    return [
        PageElement(
            element_type=ElementType.TABLE,
            element=table,
            bbox=table.bbox,
        )
        for table in tables
    ]
