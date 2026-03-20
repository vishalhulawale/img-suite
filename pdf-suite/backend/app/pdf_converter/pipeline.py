"""Main conversion pipeline — orchestrates the full PDF → target format conversion.

Pipeline stages:
  1. Open PDF and extract metadata
  2. For each page:
     a. Classify page type (digital/scanned/mixed)
     b. Analyze layout (margins, columns, headers/footers, reading order)
     c. Detect tables (line analysis)
     d. Extract content (text + images + drawings)
     e. Merge layout regions with content for reading order
  3. Build internal Document model
  4. Convert to target format (DOCX/XLSX/PPTX)
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import fitz  # PyMuPDF

from app.pdf_converter.config import OutputFormat, PipelineConfig
from app.pdf_converter.models import (
    Color, Document, DocumentMetadata, DrawingElement, ElementType, FontMapping,
    ListType, Page, PageElement, Rect, TextBlock, TextSpan,
)

logger = logging.getLogger(__name__)


class ConversionPipeline:
    """High-fidelity PDF conversion pipeline."""

    def __init__(self, config: PipelineConfig | None = None):
        self.config = config or PipelineConfig()
        self._fitz_doc: fitz.Document | None = None

    def convert(self, pdf_path: str, output_path: str | None = None) -> str:
        """Convert a PDF file to the configured output format.

        Args:
            pdf_path: Path to input PDF
            output_path: Path for output file. If None, auto-generated.

        Returns:
            Path to the output file.
        """
        pdf_path = str(Path(pdf_path).resolve())
        t0 = time.time()

        logger.info("Starting conversion: %s", pdf_path)
        logger.info("Output format: %s", self.config.output_format.value)

        # Stage 1: Open and extract metadata
        logger.info("Stage 1: Opening PDF and extracting metadata...")
        self._fitz_doc = fitz.open(pdf_path)
        metadata = self._extract_metadata(pdf_path)

        # Determine page range
        start_page = 0
        end_page = len(self._fitz_doc) - 1
        if self.config.page_range:
            start_page = max(0, self.config.page_range[0])
            end_page = min(len(self._fitz_doc) - 1, self.config.page_range[1])

        page_indices = list(range(start_page, end_page + 1))
        logger.info("Processing pages %d-%d (%d total)",
                     start_page + 1, end_page + 1, len(page_indices))

        # Stage 2: Detect document-wide patterns (headers/footers)
        logger.info("Stage 2: Detecting document-wide patterns...")
        from app.pdf_converter.analyzer import detect_header_footer
        header_y, footer_y = detect_header_footer(self._fitz_doc, page_indices)

        # Stage 3: Extract font mappings
        logger.info("Stage 3: Building font map...")
        font_map = self._build_font_map()

        # Stage 4: Process each page
        logger.info("Stage 4: Processing pages...")
        pages: list[Page] = []

        for page_idx in page_indices:
            page_num = page_idx + 1
            logger.info("  Processing page %d/%d...", page_num, len(page_indices))

            page = self._process_page(
                page_idx, pdf_path,
                header_y=header_y, footer_y=footer_y,
            )
            pages.append(page)

        # Build document
        doc = Document(
            pages=pages,
            metadata=metadata,
            font_map=font_map,
            source_path=pdf_path,
        )

        # Stage 5: Convert to target format
        logger.info("Stage 5: Converting to %s...", self.config.output_format.value)

        if output_path is None:
            output_path = str(
                Path(pdf_path).with_suffix(f".{self.config.output_format.value}")
            )

        output_path = self._run_converter(doc, output_path)

        elapsed = time.time() - t0
        logger.info("Conversion complete in %.1fs: %s", elapsed, output_path)

        self._fitz_doc.close()
        return output_path

    # -----------------------------------------------------------------------
    # Internal stages
    # -----------------------------------------------------------------------

    def _extract_metadata(self, pdf_path: str) -> DocumentMetadata:
        """Extract PDF metadata."""
        doc = self._fitz_doc
        meta = doc.metadata or {}

        return DocumentMetadata(
            title=meta.get("title", ""),
            author=meta.get("author", ""),
            subject=meta.get("subject", ""),
            creator=meta.get("creator", ""),
            producer=meta.get("producer", ""),
            creation_date=meta.get("creationDate", ""),
            modification_date=meta.get("modDate", ""),
            keywords=meta.get("keywords", "").split(",") if meta.get("keywords") else [],
            page_count=len(doc),
            file_size=Path(pdf_path).stat().st_size,
        )

    def _build_font_map(self) -> dict[str, FontMapping]:
        """Build a mapping of PDF fonts to system fonts."""
        font_map: dict[str, FontMapping] = {}

        for page_idx in range(len(self._fitz_doc)):
            page = self._fitz_doc[page_idx]
            fonts = page.get_fonts(full=True)

            for font_info in fonts:
                xref, ext, font_type, name, ref_name, encoding = font_info[:6]

                if name in font_map:
                    continue

                # Strip subset prefix
                clean_name = name
                if "+" in clean_name:
                    clean_name = clean_name.split("+", 1)[1]

                # Try to find system match
                sub_map = self.config.font.font_substitution_map
                matched = sub_map.get(clean_name, "")

                if not matched:
                    # Heuristic matching
                    lower = clean_name.lower()
                    if "times" in lower or "serif" in lower:
                        matched = self.config.font.fallback_serif
                    elif "courier" in lower or "mono" in lower or "consol" in lower:
                        matched = self.config.font.fallback_mono
                    else:
                        matched = self.config.font.fallback_sans

                # Check if font is embedded
                is_embedded = bool(ext)
                embedded_data = None
                if is_embedded and self.config.font.extract_embedded:
                    try:
                        embedded_data = self._fitz_doc.extract_font(xref)
                        if embedded_data and len(embedded_data) >= 4:
                            embedded_data = embedded_data[3]  # font binary
                        else:
                            embedded_data = None
                    except Exception:
                        embedded_data = None

                font_map[name] = FontMapping(
                    pdf_name=name,
                    matched_name=matched or clean_name,
                    is_exact_match=clean_name in sub_map,
                    is_embedded=is_embedded,
                    embedded_data=embedded_data if isinstance(embedded_data, bytes) else None,
                    fallback_name=self.config.font.fallback_sans,
                )

        return font_map

    def _process_page(
        self,
        page_idx: int,
        pdf_path: str,
        header_y: float | None = None,
        footer_y: float | None = None,
    ) -> Page:
        """Process a single page through the full pipeline."""
        from app.pdf_converter.analyzer import analyze_page
        from app.pdf_converter.extractor import extract_page_content
        from app.pdf_converter.table_detector import detect_tables

        fitz_page = self._fitz_doc[page_idx]

        # 4a. Classify and analyze layout
        analysis = analyze_page(fitz_page, page_idx, self.config)

        page_type = analysis["page_type"]
        margins = analysis["margins"]
        num_columns = analysis["num_columns"]
        column_gap = analysis["column_gap"]
        layout_regions = analysis["layout_regions"]
        body_font_size = analysis["body_font_size"]

        # 4b. Detect tables
        table_elements = detect_tables(
            fitz_page, self._fitz_doc, page_idx, self.config, pdf_path
        )

        # Get table regions to exclude from text extraction
        table_rects = [e.bbox for e in table_elements]

        # 4c. Extract content
        # Always extract digital text and images first
        content_elements = extract_page_content(
            fitz_page, self._fitz_doc, self.config,
            body_font_size, table_rects,
        )

        # Combine all elements
        all_elements = content_elements + table_elements

        page_area = fitz_page.rect.width * fitz_page.rect.height
        background_color, background_image = _detect_background_layers(
            all_elements,
            page_area,
        )

        # Assign reading order
        all_elements = _assign_reading_order(
            all_elements, layout_regions, num_columns, fitz_page.rect.width,
        )

        # Merge orphaned bullet-character blocks with their following content block
        all_elements = _merge_orphaned_bullet_markers(all_elements)

        # Mark headers/footers
        if header_y is not None:
            for elem in all_elements:
                if elem.bbox.y1 <= header_y:
                    elem.is_header = True
        if footer_y is not None:
            for elem in all_elements:
                if elem.bbox.y0 >= footer_y:
                    elem.is_footer = True

        # Build page object
        page = Page(
            page_number=page_idx,
            width=fitz_page.rect.width,
            height=fitz_page.rect.height,
            rotation=fitz_page.rotation,
            page_type=page_type,
            elements=all_elements,
            layout_regions=layout_regions,
            margin_top=margins[0],
            margin_bottom=margins[1],
            margin_left=margins[2],
            margin_right=margins[3],
            num_columns=num_columns,
            column_gap=column_gap,
            background_color=background_color,
            background_image=background_image,
        )

        if header_y is not None:
            page.header_bbox = Rect(0, 0, fitz_page.rect.width, header_y)
        if footer_y is not None:
            page.footer_bbox = Rect(0, footer_y, fitz_page.rect.width, fitz_page.rect.height)

        return page

    def _run_converter(self, doc: Document, output_path: str) -> str:
        """Run the appropriate format converter."""
        fmt = self.config.output_format

        if fmt == OutputFormat.DOCX:
            from app.pdf_converter.to_docx import convert_to_docx
            return convert_to_docx(doc, output_path, self.config)
        elif fmt == OutputFormat.XLSX:
            from app.pdf_converter.to_xlsx import convert_to_xlsx
            return convert_to_xlsx(doc, output_path, self.config)
        elif fmt == OutputFormat.PPTX:
            from app.pdf_converter.to_pptx import convert_to_pptx
            return convert_to_pptx(doc, output_path, self.config)
        else:
            raise ValueError(f"Unsupported output format: {fmt}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_background_layers(
    elements: list[PageElement],
    page_area: float,
):
    """Identify background fills and images that should survive export."""
    background_color = Color.WHITE
    background_image = None

    foreground_elements = [
        elem for elem in elements
        if elem.element_type in {ElementType.TEXT_BLOCK, ElementType.TABLE, ElementType.IMAGE}
    ]

    for elem in elements:
        if elem.element_type == ElementType.IMAGE and _covers_page(elem.bbox, page_area):
            elem.is_background = True
            if background_image is None:
                background_image = elem.element
            continue

        if elem.element_type != ElementType.DRAWING:
            continue

        drawing = elem.element
        if not isinstance(drawing, DrawingElement):
            continue

        if not _is_background_fill_drawing(elem, drawing, foreground_elements, page_area):
            continue

        elem.is_background = True
        if drawing.fill_color and _covers_page(elem.bbox, page_area):
            background_color = drawing.fill_color

    return background_color, background_image


def _is_background_fill_drawing(
    elem: PageElement,
    drawing: DrawingElement,
    foreground_elements: list[PageElement],
    page_area: float,
) -> bool:
    if drawing.fill_color is None or not _is_rectangular_drawing(drawing):
        return False

    if elem.bbox.width < 12 or elem.bbox.height < 12:
        return False

    if _covers_page(elem.bbox, page_area):
        return True

    for other in foreground_elements:
        if other is elem or other.bbox.area <= 0:
            continue

        overlap = elem.bbox.intersection(other.bbox)
        if overlap is None or overlap.area <= 0:
            continue

        if elem.bbox.contains(other.bbox):
            return True

        if overlap.area / other.bbox.area >= 0.4:
            return True

    return False


_ORPHAN_BULLET_CHARS = frozenset({"•", "●", "○", "■", "□", "▪", "▫", "‣", "⁃"})


def _merge_orphaned_bullet_markers(elements: list[PageElement]) -> list[PageElement]:
    """Merge standalone bullet-character blocks with the following content block.

    PDF presentations often encode the bullet glyph as a tiny separate text block
    positioned just before the content text. This causes both DOCX and PPTX to
    render the bullet on its own line, separated from the content. Merging them
    makes the output look like a proper bullet list item.
    """
    consumed: set[int] = set()
    result: list[PageElement] = []

    for i, elem in enumerate(elements):
        if i in consumed:
            continue

        if (elem.element_type != ElementType.TEXT_BLOCK
                or not isinstance(elem.element, TextBlock)):
            result.append(elem)
            continue

        block = elem.element
        block_text = block.text.strip()

        # Must be a single-line, single-span block whose only content is one bullet char
        if (block_text not in _ORPHAN_BULLET_CHARS
                or len(block.lines) != 1
                or len(block.lines[0].spans) != 1):
            result.append(elem)
            continue

        # Find the next non-empty text block (scan ahead up to 5 elements)
        next_idx: int | None = None
        for j in range(i + 1, min(i + 6, len(elements))):
            if j in consumed:
                continue
            nxt = elements[j]
            if (nxt.element_type == ElementType.TEXT_BLOCK
                    and isinstance(nxt.element, TextBlock)
                    and nxt.element.text.strip()):
                next_idx = j
                break

        if next_idx is None:
            result.append(elem)
            continue

        next_elem = elements[next_idx]
        next_block = next_elem.element

        # Only merge when the bullet and content are at (roughly) the same vertical level
        bullet_height = max(elem.bbox.height, 4.0)
        y_dist = abs(next_elem.bbox.y0 - elem.bbox.y0)
        if y_dist > bullet_height * 2.5:
            result.append(elem)
            continue

        # Build a bullet span using the bullet block's own font metadata
        marker_span = block.lines[0].spans[0]
        bullet_span = TextSpan(
            text=block_text + " ",
            font=marker_span.font,
            bbox=elem.bbox,
            origin=marker_span.origin,
        )

        # Prepend bullet span to the first line of the content block
        if next_block.lines:
            next_block.lines[0].spans.insert(0, bullet_span)

        # Tag the merged block so renderers know it is a list item
        next_block.list_type = ListType.BULLET
        next_block.list_marker = block_text

        # Expand the content element's bbox to start at the bullet's x0
        bx0 = min(elem.bbox.x0, next_elem.bbox.x0)
        by0 = min(elem.bbox.y0, next_elem.bbox.y0)
        next_elem.bbox = Rect(bx0, by0, next_elem.bbox.x1, next_elem.bbox.y1)

        # Mark the content block as consumed so it isn't added again later
        consumed.add(next_idx)
        # Add the merged element now (at the bullet's position in iteration order)
        result.append(next_elem)

    return result


def _is_rectangular_drawing(drawing: DrawingElement) -> bool:
    """Check if drawing uses filled path commands (rectangle, polygon, or curve)."""
    # Accept "re" (explicit rectangle) or any closed path with fill-worthy commands
    PATH_CMDS = frozenset({"re", "l", "c", "q", "m", "h"})
    return any(cmd.get("type") in PATH_CMDS for cmd in drawing.raw_commands)


def _covers_page(bbox: Rect, page_area: float, threshold: float = 0.85) -> bool:
    if page_area <= 0 or bbox.area <= 0:
        return False
    return bbox.area / page_area >= threshold


def _assign_reading_order(
    elements: list[PageElement],
    layout_regions,
    num_columns: int,
    page_width: float,
) -> list[PageElement]:
    """Assign reading order to elements based on layout analysis."""
    if not elements:
        return elements

    if num_columns <= 1:
        # Single column: top-to-bottom, left-to-right
        elements.sort(key=lambda e: (e.bbox.y0, e.bbox.x0))
    else:
        # Multi-column: column-by-column ordering
        col_width = page_width / num_columns
        for elem in elements:
            center_x = elem.bbox.center[0]
            elem.column_index = min(int(center_x / col_width), num_columns - 1)

        elements.sort(key=lambda e: (e.column_index, e.bbox.y0, e.bbox.x0))

    for i, elem in enumerate(elements):
        elem.reading_order = i

    return elements
