"""PDF page classifier and layout analyzer.

Determines whether each page is digital/scanned/mixed and detects
page structure: columns, headers/footers, margins, reading order.
"""

from __future__ import annotations

import logging
from statistics import median, mean

import fitz  # PyMuPDF

from app.pdf_converter.config import PipelineConfig
from app.pdf_converter.models import (
    LayoutRegion, PageType, Rect,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Page classification
# ---------------------------------------------------------------------------

def classify_page(fitz_page: fitz.Page) -> PageType:
    """Classify a page as digital, scanned, or mixed.

    Heuristic:
      - Extract text; check absolute character count
      - Count images and their coverage of the page
      - If PyMuPDF extracts meaningful text the text layer is digital
    """
    page_rect = fitz_page.rect
    page_area = page_rect.width * page_rect.height
    if page_area == 0:
        return PageType.DIGITAL

    # Text analysis
    text = fitz_page.get_text("text")
    text_len = len(text.strip())

    # Image analysis
    image_list = fitz_page.get_images(full=True)
    total_image_area = 0.0
    large_images = 0

    for img_info in image_list:
        xref = img_info[0]
        try:
            img_rects = fitz_page.get_image_rects(xref)
            for r in img_rects:
                area = abs(r.width * r.height)
                total_image_area += area
                if area > page_area * 0.5:
                    large_images += 1
        except Exception:
            pass

    image_coverage = total_image_area / page_area if page_area > 0 else 0

    has_digital_text = text_len >= 15
    has_images = image_coverage > 0.5 or large_images > 0

    if not has_digital_text and has_images:
        return PageType.SCANNED
    elif has_digital_text and has_images:
        return PageType.MIXED
    elif has_digital_text:
        return PageType.DIGITAL
    else:
        return PageType.DIGITAL


# ---------------------------------------------------------------------------
# Margin detection
# ---------------------------------------------------------------------------

def detect_margins(fitz_page: fitz.Page) -> tuple[float, float, float, float]:
    """Detect page margins from content boundaries.

    Returns (top, bottom, left, right) in points.
    """
    page_rect = fitz_page.rect
    blocks = fitz_page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

    if not blocks:
        return (72.0, 72.0, 72.0, 72.0)

    content_x0 = page_rect.width
    content_y0 = page_rect.height
    content_x1 = 0.0
    content_y1 = 0.0

    for block in blocks:
        bbox = block.get("bbox", (0, 0, 0, 0))
        if bbox[2] - bbox[0] < 1 or bbox[3] - bbox[1] < 1:
            continue
        content_x0 = min(content_x0, bbox[0])
        content_y0 = min(content_y0, bbox[1])
        content_x1 = max(content_x1, bbox[2])
        content_y1 = max(content_y1, bbox[3])

    margin_left = max(0, content_x0)
    margin_top = max(0, content_y0)
    margin_right = max(0, page_rect.width - content_x1)
    margin_bottom = max(0, page_rect.height - content_y1)

    # Clamp to reasonable values
    min_margin = 18.0   # ~0.25"
    max_margin = 144.0  # ~2"
    margin_left = max(min_margin, min(max_margin, margin_left))
    margin_top = max(min_margin, min(max_margin, margin_top))
    margin_right = max(min_margin, min(max_margin, margin_right))
    margin_bottom = max(min_margin, min(max_margin, margin_bottom))

    return (margin_top, margin_bottom, margin_left, margin_right)


# ---------------------------------------------------------------------------
# Column detection
# ---------------------------------------------------------------------------

def detect_columns(fitz_page: fitz.Page, config: PipelineConfig) -> tuple[int, float]:
    """Detect number of text columns and gap width.

    Returns (num_columns, column_gap_pts).
    """
    blocks = fitz_page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
    text_blocks = [b for b in blocks if b.get("type") == 0 and b.get("lines")]

    if len(text_blocks) < 4:
        return (1, 0.0)

    page_width = fitz_page.rect.width
    margins = detect_margins(fitz_page)
    content_left = margins[2]
    content_right = page_width - margins[3]
    content_width = content_right - content_left

    if content_width < 100:
        return (1, 0.0)

    # Collect left/right edges of text blocks
    left_edges: list[float] = []
    right_edges: list[float] = []

    for b in text_blocks:
        bbox = b["bbox"]
        block_width = bbox[2] - bbox[0]
        if block_width < content_width * 0.15:
            continue
        if block_width > content_width * 0.85:
            continue
        left_edges.append(bbox[0])
        right_edges.append(bbox[2])

    if len(left_edges) < 4:
        return (1, 0.0)

    # Cluster left edges to find column starts
    left_edges.sort()
    clusters: list[list[float]] = []
    current_cluster = [left_edges[0]]

    for edge in left_edges[1:]:
        if edge - current_cluster[-1] < config.layout.column_gap_threshold:
            current_cluster.append(edge)
        else:
            if len(current_cluster) >= 2:
                clusters.append(current_cluster)
            current_cluster = [edge]
    if len(current_cluster) >= 2:
        clusters.append(current_cluster)

    num_columns = len(clusters)

    if num_columns <= 1:
        return (1, 0.0)

    # Estimate gap between columns
    cluster_centers = [mean(c) for c in clusters]
    right_edges.sort()

    col1_right = median([r for r in right_edges if r < page_width / 2]) if right_edges else 0
    col2_left = cluster_centers[1] if len(cluster_centers) > 1 else 0
    gap = max(0, col2_left - col1_right) if col2_left > col1_right else 36.0

    return (min(num_columns, 4), gap)


# ---------------------------------------------------------------------------
# Header / Footer detection
# ---------------------------------------------------------------------------

def detect_header_footer(
    fitz_doc: fitz.Document,
    page_indices: list[int],
) -> tuple[float | None, float | None]:
    """Detect consistent header/footer boundaries across pages.

    Returns (header_bottom_y, footer_top_y) or None if not detected.
    """
    if len(page_indices) < 3:
        return (None, None)

    sample_indices = page_indices[:10]
    top_texts: list[list[tuple[float, str]]] = []
    bottom_texts: list[list[tuple[float, str]]] = []

    for idx in sample_indices:
        page = fitz_doc[idx]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        text_blocks = [b for b in blocks if b.get("type") == 0 and b.get("lines")]
        page_height = page.rect.height

        top_zone = [(b["bbox"][3], _block_text(b)) for b in text_blocks
                     if b["bbox"][1] < page_height * 0.1]
        bottom_zone = [(b["bbox"][1], _block_text(b)) for b in text_blocks
                        if b["bbox"][3] > page_height * 0.9]
        top_texts.append(top_zone)
        bottom_texts.append(bottom_zone)

    header_y = _find_consistent_zone_boundary(top_texts, mode="max")
    footer_y = _find_consistent_zone_boundary(bottom_texts, mode="min")

    return (header_y, footer_y)


def _block_text(block: dict) -> str:
    parts: list[str] = []
    for line in block.get("lines", []):
        for span in line.get("spans", []):
            parts.append(span.get("text", ""))
    return " ".join(parts).strip()


def _find_consistent_zone_boundary(
    zone_texts: list[list[tuple[float, str]]],
    mode: str,
) -> float | None:
    """Find a consistent Y boundary across pages."""
    positions: list[float] = []
    non_empty_count = 0

    for page_zones in zone_texts:
        if page_zones:
            non_empty_count += 1
            if mode == "max":
                positions.append(max(z[0] for z in page_zones))
            else:
                positions.append(min(z[0] for z in page_zones))

    if non_empty_count < len(zone_texts) * 0.6:
        return None

    if not positions:
        return None

    avg = mean(positions)
    if len(positions) > 1:
        variance = sum((p - avg) ** 2 for p in positions) / len(positions)
        std_dev = variance ** 0.5
        if std_dev > 10:
            return None

    return avg


# ---------------------------------------------------------------------------
# Heading detection (heuristic)
# ---------------------------------------------------------------------------

def detect_heading_level(
    font_size: float,
    is_bold: bool,
    body_font_size: float,
    config: PipelineConfig,
) -> int:
    """Determine heading level from font properties.

    Returns 0 for body text, 1-6 for heading levels.
    """
    if body_font_size <= 0:
        return 0

    ratio = font_size / body_font_size

    if ratio < config.layout.heading_size_ratio:
        return 0

    if ratio >= 2.0 or (ratio >= 1.8 and is_bold):
        return 1
    elif ratio >= 1.6 or (ratio >= 1.4 and is_bold):
        return 2
    elif ratio >= 1.3 or (ratio >= 1.2 and is_bold):
        return 3
    elif is_bold and ratio >= 1.1:
        return 4
    elif is_bold:
        return 5
    elif ratio >= config.layout.heading_size_ratio:
        return 6

    return 0


def estimate_body_font_size(fitz_page: fitz.Page) -> float:
    """Estimate the most common (body) font size on a page."""
    blocks = fitz_page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
    size_counts: dict[float, int] = {}

    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                size = round(span.get("size", 12.0), 1)
                text = span.get("text", "")
                size_counts[size] = size_counts.get(size, 0) + len(text)

    if not size_counts:
        return 12.0

    return max(size_counts, key=size_counts.get)


# ---------------------------------------------------------------------------
# Reading order
# ---------------------------------------------------------------------------

def compute_reading_order(
    regions: list[LayoutRegion],
    num_columns: int,
    page_width: float,
) -> list[LayoutRegion]:
    """Assign reading order to layout regions based on column-aware ordering."""
    if not regions:
        return regions

    if num_columns <= 1:
        regions.sort(key=lambda r: (r.bbox.y0, r.bbox.x0))
        for i, r in enumerate(regions):
            r.reading_order = i
        return regions

    col_width = page_width / num_columns
    for r in regions:
        center_x = r.bbox.center[0]
        r.column_index = min(int(center_x / col_width), num_columns - 1)

    regions.sort(key=lambda r: (r.column_index, r.bbox.y0, r.bbox.x0))
    for i, r in enumerate(regions):
        r.reading_order = i

    return regions


# ---------------------------------------------------------------------------
# Full page analysis
# ---------------------------------------------------------------------------

def analyze_page(
    fitz_page: fitz.Page,
    page_number: int,
    config: PipelineConfig,
) -> dict:
    """Run complete analysis on a single page.

    Returns dict with:
      - page_type: PageType
      - margins: (top, bottom, left, right)
      - num_columns: int
      - column_gap: float
      - layout_regions: list[LayoutRegion]
      - body_font_size: float
    """
    page_type = classify_page(fitz_page)
    margins = detect_margins(fitz_page)
    num_columns, column_gap = detect_columns(fitz_page, config)
    body_font_size = estimate_body_font_size(fitz_page)

    # Heuristic layout only — no AI models
    layout_regions: list[LayoutRegion] = []

    if layout_regions:
        layout_regions = compute_reading_order(
            layout_regions, num_columns, fitz_page.rect.width
        )

    return {
        "page_type": page_type,
        "margins": margins,
        "num_columns": num_columns,
        "column_gap": column_gap,
        "layout_regions": layout_regions,
        "body_font_size": body_font_size,
    }
