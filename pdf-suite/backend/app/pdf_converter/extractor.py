"""Core content extractor — extracts text, images, and drawings from PDF pages.

Uses PyMuPDF for precise extraction of every visual element with full
formatting metadata (font, size, color, position, spacing).
"""

from __future__ import annotations

import io
import logging
from collections import defaultdict

import fitz  # PyMuPDF
from PIL import Image as PILImage

from app.pdf_converter.config import PipelineConfig
from app.pdf_converter.models import (
    Color, DrawingElement, ElementType, FontInfo, ImageElement,
    PageElement, Rect, TextAlignment, TextBlock, TextLine, TextSpan,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Font helpers
# ---------------------------------------------------------------------------

def _parse_font_flags(flags: int) -> dict:
    """Parse PyMuPDF font flags into readable properties."""
    return {
        "superscript": bool(flags & 1),
        "italic": bool(flags & 2),
        "serif": bool(flags & 4),
        "monospace": bool(flags & 8),
        "bold": bool(flags & 16),
    }


def _resolve_font_name(raw_name: str, config: PipelineConfig) -> str:
    """Resolve PDF font name to a system font name."""
    # Strip subset prefix (e.g., "ABCDEF+Arial" -> "Arial")
    if "+" in raw_name:
        raw_name = raw_name.split("+", 1)[1]

    # Check substitution map
    sub_map = config.font.font_substitution_map
    if raw_name in sub_map:
        return sub_map[raw_name]

    # Try stripping common suffixes
    clean = raw_name.replace(",Bold", "").replace(",Italic", "")
    clean = clean.replace(",BoldItalic", "").replace("-Regular", "")
    clean = clean.replace("PS", "").replace("MT", "")
    if clean in sub_map:
        return sub_map[clean]

    return raw_name


def _make_font_info(span: dict, config: PipelineConfig) -> FontInfo:
    """Build FontInfo from a PyMuPDF span dict."""
    flags = span.get("flags", 0)
    parsed = _parse_font_flags(flags)
    raw_name = span.get("font", "Arial")
    color_int = span.get("color", 0)

    # PyMuPDF gives color as int — convert to RGB
    r = ((color_int >> 16) & 0xFF) / 255.0
    g = ((color_int >> 8) & 0xFF) / 255.0
    b = (color_int & 0xFF) / 255.0

    return FontInfo(
        name=_resolve_font_name(raw_name, config),
        family=raw_name,
        size=span.get("size", 12.0),
        bold=parsed["bold"],
        italic=parsed["italic"],
        monospace=parsed["monospace"],
        serif=parsed["serif"],
        color=Color(r, g, b),
        flags=flags,
        superscript=parsed["superscript"],
    )


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_blocks(
    fitz_page: fitz.Page,
    config: PipelineConfig,
    body_font_size: float = 12.0,
    excluded_rects: list[Rect] | None = None,
) -> list[PageElement]:
    """Extract all text blocks from a page with full formatting.

    Args:
        fitz_page: The PyMuPDF page object
        config: Pipeline configuration
        body_font_size: Estimated body text size for heading detection
        excluded_rects: Regions to skip (e.g., detected table areas)

    Returns:
        List of PageElement wrapping TextBlocks
    """
    raw = fitz_page.get_text("rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_PRESERVE_LIGATURES)
    page_elements: list[PageElement] = []

    for block_idx, block in enumerate(raw.get("blocks", [])):
        if block.get("type") != 0:  # text blocks only
            continue

        block_bbox = Rect(*block["bbox"])

        # Skip if block falls inside an excluded region (table area)
        if excluded_rects and _is_inside_any(block_bbox, excluded_rects):
            continue

        lines: list[TextLine] = []
        all_sizes: list[float] = []
        all_aligns: list[float] = []

        for line_data in block.get("lines", []):
            line_bbox = Rect(*line_data["bbox"])
            spans: list[TextSpan] = []

            for span_data in line_data.get("spans", []):
                # rawdict stores text in 'chars' array, not 'text'
                text = span_data.get("text") or ""
                if not text and "chars" in span_data:
                    text = "".join(c.get("c", "") for c in span_data["chars"])
                if not text:
                    continue

                font_info = _make_font_info(span_data, config)
                span_bbox = Rect(*span_data["bbox"])
                origin = tuple(span_data.get("origin", (span_bbox.x0, span_bbox.y1)))

                spans.append(TextSpan(
                    text=text,
                    font=font_info,
                    bbox=span_bbox,
                    origin=origin,
                    char_spacing=span_data.get("char_spacing", 0.0) if "char_spacing" in span_data else 0.0,
                ))
                all_sizes.append(font_info.size)

            if spans:
                lines.append(TextLine(
                    spans=spans,
                    bbox=line_bbox,
                    direction=_detect_direction(line_data),
                    writing_mode=line_data.get("wmode", 0) and "vertical" or "horizontal",
                ))
                all_aligns.append(line_bbox.x0)

        if not lines:
            continue

        # Detect alignment
        alignment = _detect_alignment(lines, fitz_page.rect.width)

        # Detect line spacing
        line_spacing = _compute_line_spacing(lines, body_font_size)

        # Detect paragraph spacing
        space_before, space_after = 0.0, 0.0

        # Detect first-line indent
        indent_first = 0.0
        if len(lines) >= 2:
            indent_first = max(0, lines[0].bbox.x0 - lines[1].bbox.x0)

        # Detect heading level
        from app.pdf_converter.analyzer import detect_heading_level
        dominant_font = lines[0].dominant_font if lines else None
        heading_level = 0
        if dominant_font and config.layout.detect_headings:
            heading_level = detect_heading_level(
                dominant_font.size, dominant_font.bold, body_font_size, config
            )

        # Detect list
        list_type, list_marker, list_level = _detect_list(lines)

        text_block = TextBlock(
            lines=lines,
            bbox=block_bbox,
            alignment=alignment,
            line_spacing=line_spacing,
            space_before=space_before,
            space_after=space_after,
            indent_first=indent_first,
            heading_level=heading_level,
            list_type=list_type,
            list_marker=list_marker,
            list_level=list_level,
        )

        page_elements.append(PageElement(
            element_type=ElementType.TEXT_BLOCK,
            element=text_block,
            bbox=block_bbox,
            z_order=block_idx,
        ))

    return page_elements


def _detect_direction(line_data: dict) -> str:
    """Detect text direction (LTR/RTL)."""
    spans = line_data.get("spans", [])
    if not spans:
        return "ltr"
    dir_val = line_data.get("dir", (1, 0))
    if isinstance(dir_val, (list, tuple)) and len(dir_val) >= 1:
        return "rtl" if dir_val[0] < 0 else "ltr"
    return "ltr"


def _detect_alignment(lines: list[TextLine], page_width: float) -> TextAlignment:
    """Detect text alignment from line positions."""
    if len(lines) < 2:
        return TextAlignment.LEFT

    lefts = [l.bbox.x0 for l in lines]
    rights = [l.bbox.x1 for l in lines]
    centers = [l.bbox.center[0] for l in lines]

    left_var = _variance(lefts)
    right_var = _variance(rights)
    center_var = _variance(centers)

    # Check for justified (both edges aligned)
    if left_var < 3 and right_var < 3 and len(lines) >= 3:
        return TextAlignment.JUSTIFY

    if center_var < left_var and center_var < right_var:
        return TextAlignment.CENTER
    if right_var < left_var:
        return TextAlignment.RIGHT

    return TextAlignment.LEFT


def _variance(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    avg = sum(values) / len(values)
    return sum((v - avg) ** 2 for v in values) / len(values)


def _compute_line_spacing(lines: list[TextLine], body_font_size: float) -> float:
    """Compute line spacing as a multiplier of font size."""
    if len(lines) < 2 or body_font_size <= 0:
        return 1.0

    spacings: list[float] = []
    for i in range(1, len(lines)):
        gap = lines[i].bbox.y0 - lines[i - 1].bbox.y0
        if gap > 0:
            spacings.append(gap)

    if not spacings:
        return 1.0

    avg_spacing = sum(spacings) / len(spacings)
    return avg_spacing / body_font_size


_LIST_BULLET_MARKERS = {"•", "●", "○", "■", "□", "▪", "▫", "‣", "⁃", "-", "–", "—", "►", "➤", "✦"}
_LIST_NUMBER_PATTERNS = {"1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.",
                          "a.", "b.", "c.", "d.", "i.", "ii.", "iii.", "iv.",
                          "1)", "2)", "3)", "4)", "a)", "b)", "c)", "d)"}


def _detect_list(lines: list[TextLine]):
    """Detect if a text block is a list item."""
    from app.pdf_converter.models import ListType
    if not lines or not lines[0].spans:
        return ListType.NONE, "", 0

    first_text = lines[0].spans[0].text.strip()

    # Bullet detection
    for marker in _LIST_BULLET_MARKERS:
        if first_text.startswith(marker):
            indent = lines[0].bbox.x0
            level = max(0, int(indent / 36))  # rough indent level
            return ListType.BULLET, marker, level

    # Number detection
    for pattern in _LIST_NUMBER_PATTERNS:
        if first_text.startswith(pattern):
            indent = lines[0].bbox.x0
            level = max(0, int(indent / 36))
            return ListType.NUMBERED, pattern, level

    return ListType.NONE, "", 0


def _is_inside_any(bbox: Rect, rects: list[Rect], threshold: float = 0.7) -> bool:
    """Check if bbox overlaps significantly with any rect in the list."""
    for r in rects:
        intersection = bbox.intersection(r)
        if intersection and bbox.area > 0:
            overlap = intersection.area / bbox.area
            if overlap > threshold:
                return True
    return False


# ---------------------------------------------------------------------------
# Image extraction
# ---------------------------------------------------------------------------

def extract_images(
    fitz_page: fitz.Page,
    fitz_doc: fitz.Document,
    config: PipelineConfig,
) -> list[PageElement]:
    """Extract all images from a page at their original resolution."""
    page_elements: list[PageElement] = []
    image_list = fitz_page.get_images(full=True)
    seen_xrefs: set[int] = set()

    for img_idx, img_info in enumerate(image_list):
        xref = img_info[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)

        try:
            # Get image placement rectangles on this page
            img_rects = fitz_page.get_image_rects(xref)
            if not img_rects:
                continue

            # Extract image at full resolution
            base_image = fitz_doc.extract_image(xref)
            if not base_image:
                continue

            img_bytes = base_image["image"]
            img_ext = base_image.get("ext", "png")
            width = base_image.get("width", 0)
            height = base_image.get("height", 0)

            # Handle SMASK (transparency mask)
            mask_data = None
            smask_xref = base_image.get("smask", 0)
            if smask_xref:
                try:
                    mask_image = fitz_doc.extract_image(smask_xref)
                    if mask_image:
                        mask_data = mask_image["image"]
                except Exception:
                    pass

            # For each placement of this image on the page
            for rect in img_rects:
                bbox = Rect(rect.x0, rect.y0, rect.x1, rect.y1)

                # Skip tiny images (likely artifacts)
                if bbox.width < 5 or bbox.height < 5:
                    continue

                # Composite image with mask if needed
                final_bytes = img_bytes
                img_format = img_ext

                if mask_data:
                    try:
                        final_bytes, img_format = _apply_alpha_mask(
                            img_bytes, mask_data, width, height
                        )
                    except Exception:
                        pass

                image_elem = ImageElement(
                    image_data=final_bytes,
                    image_format=img_format,
                    bbox=bbox,
                    original_width=width,
                    original_height=height,
                    dpi=_estimate_dpi(width, height, bbox),
                    xref=xref,
                    mask_data=mask_data,
                    transparency=mask_data is not None,
                )

                page_elements.append(PageElement(
                    element_type=ElementType.IMAGE,
                    element=image_elem,
                    bbox=bbox,
                    z_order=-1,  # Images typically behind text
                ))

        except Exception as e:
            logger.warning("Failed to extract image xref=%d: %s", xref, e)

    return page_elements


def _apply_alpha_mask(
    img_bytes: bytes, mask_bytes: bytes, width: int, height: int
) -> tuple[bytes, str]:
    """Apply an alpha mask to an image, returning PNG with transparency."""
    img = PILImage.open(io.BytesIO(img_bytes)).convert("RGBA")
    mask = PILImage.open(io.BytesIO(mask_bytes)).convert("L")

    if mask.size != img.size:
        mask = mask.resize(img.size, PILImage.LANCZOS)

    img.putalpha(mask)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), "png"


def _estimate_dpi(pixel_w: int, pixel_h: int, bbox: Rect) -> float:
    """Estimate image DPI from pixel dimensions and placement size in points."""
    if bbox.width <= 0 or bbox.height <= 0:
        return 300.0
    dpi_x = pixel_w / (bbox.width / 72.0) if bbox.width > 0 else 300
    dpi_y = pixel_h / (bbox.height / 72.0) if bbox.height > 0 else 300
    return (dpi_x + dpi_y) / 2


# ---------------------------------------------------------------------------
# Drawing / vector extraction
# ---------------------------------------------------------------------------

def extract_drawings(fitz_page: fitz.Page) -> list[PageElement]:
    """Extract vector drawings/paths from the page."""
    page_elements: list[PageElement] = []
    drawings = fitz_page.get_drawings()

    for idx, path in enumerate(drawings):
        items = path.get("items", [])
        if not items:
            continue

        rect = path.get("rect")
        if not rect:
            continue

        bbox = Rect(rect.x0, rect.y0, rect.x1, rect.y1)

        # Skip very small drawings (likely dots, line ends)
        if bbox.width < 2 and bbox.height < 2:
            continue

        fill = path.get("fill")
        stroke = path.get("color")
        stroke_width = path.get("width", 1.0)
        opacity = path.get("fill_opacity", 1.0)

        fill_color = None
        if fill:
            if isinstance(fill, (list, tuple)) and len(fill) >= 3:
                fill_color = Color(fill[0], fill[1], fill[2])

        stroke_color = None
        if stroke:
            if isinstance(stroke, (list, tuple)) and len(stroke) >= 3:
                stroke_color = Color(stroke[0], stroke[1], stroke[2])

        # Convert path items to raw commands
        raw_commands = []
        for item in items:
            cmd_type = item[0]
            raw_commands.append({
                "type": cmd_type,
                "points": [list(p) if hasattr(p, '__iter__') else p for p in item[1:]],
            })

        drawing = DrawingElement(
            bbox=bbox,
            fill_color=fill_color,
            stroke_color=stroke_color,
            stroke_width=stroke_width or 1.0,
            opacity=opacity or 1.0,
            raw_commands=raw_commands,
        )

        page_elements.append(PageElement(
            element_type=ElementType.DRAWING,
            element=drawing,
            bbox=bbox,
            z_order=-2,
        ))

    return page_elements


# ---------------------------------------------------------------------------
# Full page extraction
# ---------------------------------------------------------------------------

def extract_page_content(
    fitz_page: fitz.Page,
    fitz_doc: fitz.Document,
    config: PipelineConfig,
    body_font_size: float = 12.0,
    table_rects: list[Rect] | None = None,
) -> list[PageElement]:
    """Extract all content from a page.

    Args:
        fitz_page: PyMuPDF page
        fitz_doc: PyMuPDF document
        config: Pipeline configuration
        body_font_size: Body text size for heading detection
        table_rects: Already-detected table regions to exclude from text extraction

    Returns:
        Combined list of all page elements (text, images, drawings)
    """
    elements: list[PageElement] = []

    # 1. Extract text blocks (excluding table regions)
    text_elements = extract_text_blocks(
        fitz_page, config, body_font_size, excluded_rects=table_rects
    )
    elements.extend(text_elements)

    # 2. Extract images
    image_elements = extract_images(fitz_page, fitz_doc, config)
    elements.extend(image_elements)

    # 3. Extract vector drawings
    drawing_elements = extract_drawings(fitz_page)
    elements.extend(drawing_elements)

    return elements
