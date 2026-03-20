"""Internal document model capturing every visual detail from a PDF.

All coordinates are in PDF points (1/72 inch) with origin at top-left.
Colors are stored as (R, G, B) tuples with values 0.0-1.0.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class PageType(enum.Enum):
    DIGITAL = "digital"
    SCANNED = "scanned"
    MIXED = "mixed"


class TextAlignment(enum.Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"


class ListType(enum.Enum):
    NONE = "none"
    BULLET = "bullet"
    NUMBERED = "numbered"


class BorderStyle(enum.Enum):
    NONE = "none"
    SOLID = "solid"
    DASHED = "dashed"
    DOTTED = "dotted"
    DOUBLE = "double"


class ElementType(enum.Enum):
    TEXT_BLOCK = "text_block"
    IMAGE = "image"
    TABLE = "table"
    DRAWING = "drawing"
    HEADER = "header"
    FOOTER = "footer"


class LayoutRegionType(enum.Enum):
    TITLE = "title"
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST = "list"
    TABLE = "table"
    FIGURE = "figure"
    CAPTION = "caption"
    HEADER = "header"
    FOOTER = "footer"
    PAGE_NUMBER = "page_number"
    SIDEBAR = "sidebar"
    FOOTNOTE = "footnote"
    EQUATION = "equation"
    COLUMN = "column"


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class Rect:
    """Axis-aligned rectangle: (x0, y0) = top-left, (x1, y1) = bottom-right."""
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2)

    @property
    def area(self) -> float:
        return max(0, self.width) * max(0, self.height)

    def intersects(self, other: Rect) -> bool:
        return not (self.x1 <= other.x0 or other.x1 <= self.x0 or
                    self.y1 <= other.y0 or other.y1 <= self.y0)

    def intersection(self, other: Rect) -> Rect | None:
        x0 = max(self.x0, other.x0)
        y0 = max(self.y0, other.y0)
        x1 = min(self.x1, other.x1)
        y1 = min(self.y1, other.y1)
        if x0 < x1 and y0 < y1:
            return Rect(x0, y0, x1, y1)
        return None

    def contains(self, other: Rect) -> bool:
        return (self.x0 <= other.x0 and self.y0 <= other.y0 and
                self.x1 >= other.x1 and self.y1 >= other.y1)

    def expand(self, margin: float) -> Rect:
        return Rect(self.x0 - margin, self.y0 - margin,
                     self.x1 + margin, self.y1 + margin)

    def to_tuple(self) -> tuple[float, float, float, float]:
        return (self.x0, self.y0, self.x1, self.y1)


# ---------------------------------------------------------------------------
# Color
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Color:
    """RGB color, each channel 0.0-1.0."""
    r: float = 0.0
    g: float = 0.0
    b: float = 0.0

    def to_hex(self) -> str:
        return "#{:02X}{:02X}{:02X}".format(
            int(self.r * 255), int(self.g * 255), int(self.b * 255)
        )

    def to_rgb_int(self) -> tuple[int, int, int]:
        return (int(self.r * 255), int(self.g * 255), int(self.b * 255))

    @classmethod
    def from_hex(cls, hex_str: str) -> Color:
        hex_str = hex_str.lstrip("#")
        return cls(
            r=int(hex_str[0:2], 16) / 255,
            g=int(hex_str[2:4], 16) / 255,
            b=int(hex_str[4:6], 16) / 255,
        )

    @classmethod
    def from_rgb_int(cls, r: int, g: int, b: int) -> Color:
        return cls(r=r / 255, g=g / 255, b=b / 255)


Color.BLACK = Color(0.0, 0.0, 0.0)
Color.WHITE = Color(1.0, 1.0, 1.0)


# ---------------------------------------------------------------------------
# Font / Text primitives
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class FontInfo:
    """Complete font descriptor."""
    name: str = "Arial"
    family: str = ""
    size: float = 12.0
    bold: bool = False
    italic: bool = False
    monospace: bool = False
    serif: bool = False
    color: Color = field(default_factory=lambda: Color(0.0, 0.0, 0.0))
    flags: int = 0          # Raw PDF font flags
    superscript: bool = False
    subscript: bool = False
    underline: bool = False
    strikethrough: bool = False
    highlight_color: Color | None = None


@dataclass(slots=True)
class TextSpan:
    """A contiguous run of text with uniform formatting."""
    text: str
    font: FontInfo
    bbox: Rect
    origin: tuple[float, float] = (0.0, 0.0)  # baseline origin
    char_spacing: float = 0.0
    word_spacing: float = 0.0
    confidence: float = 1.0  # 1.0 for digital, <1.0 for OCR


@dataclass(slots=True)
class TextLine:
    """A single line of text composed of spans."""
    spans: list[TextSpan] = field(default_factory=list)
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    direction: str = "ltr"
    writing_mode: str = "horizontal"

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    @property
    def dominant_font(self) -> FontInfo | None:
        if not self.spans:
            return None
        return max(self.spans, key=lambda s: len(s.text)).font


@dataclass(slots=True)
class TextBlock:
    """A paragraph or block of text composed of lines."""
    lines: list[TextLine] = field(default_factory=list)
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    alignment: TextAlignment = TextAlignment.LEFT
    line_spacing: float = 1.0        # multiplier
    space_before: float = 0.0        # pts
    space_after: float = 0.0         # pts
    indent_first: float = 0.0        # pts
    indent_left: float = 0.0         # pts
    indent_right: float = 0.0        # pts
    list_type: ListType = ListType.NONE
    list_level: int = 0
    list_marker: str = ""
    heading_level: int = 0           # 0 = not a heading, 1-6 = heading level
    is_continuation: bool = False    # paragraph continues from previous page
    background_color: Color | None = None

    @property
    def text(self) -> str:
        return "\n".join(line.text for line in self.lines)

    @property
    def dominant_font(self) -> FontInfo | None:
        fonts: list[tuple[FontInfo, int]] = []
        for line in self.lines:
            for span in line.spans:
                fonts.append((span.font, len(span.text)))
        if not fonts:
            return None
        return max(fonts, key=lambda x: x[1])[0]


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ImageElement:
    """An image extracted from the PDF."""
    image_data: bytes                 # Raw image bytes (PNG/JPEG)
    image_format: str = "png"        # "png", "jpeg", etc.
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    original_width: int = 0          # pixels
    original_height: int = 0         # pixels
    dpi: float = 300.0
    rotation: float = 0.0            # degrees clockwise
    transparency: bool = False
    xref: int = 0                    # PDF internal ref
    mask_data: bytes | None = None   # Alpha mask if present


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class CellBorder:
    """Border specification for one side of a cell."""
    width: float = 0.5
    color: Color = field(default_factory=lambda: Color(0.0, 0.0, 0.0))
    style: BorderStyle = BorderStyle.SOLID


@dataclass(slots=True)
class TableCell:
    """A single cell within a table."""
    content: list[TextBlock] = field(default_factory=list)
    images: list[ImageElement] = field(default_factory=list)
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    row_span: int = 1
    col_span: int = 1
    row_index: int = 0
    col_index: int = 0
    background_color: Color | None = None
    border_top: CellBorder = field(default_factory=CellBorder)
    border_bottom: CellBorder = field(default_factory=CellBorder)
    border_left: CellBorder = field(default_factory=CellBorder)
    border_right: CellBorder = field(default_factory=CellBorder)
    vertical_alignment: str = "top"  # top, center, bottom
    padding_top: float = 1.0
    padding_bottom: float = 1.0
    padding_left: float = 2.0
    padding_right: float = 2.0

    @property
    def text(self) -> str:
        return "\n".join(block.text for block in self.content)


@dataclass(slots=True)
class TableElement:
    """A complete table with cells, rows, and columns."""
    cells: list[TableCell] = field(default_factory=list)
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    num_rows: int = 0
    num_cols: int = 0
    col_widths: list[float] = field(default_factory=list)   # pts
    row_heights: list[float] = field(default_factory=list)   # pts
    has_header_row: bool = False
    detection_method: str = ""       # "lattice", "stream", "ai"
    confidence: float = 1.0

    def get_cell(self, row: int, col: int) -> TableCell | None:
        for cell in self.cells:
            if cell.row_index == row and cell.col_index == col:
                return cell
            if (cell.row_index <= row < cell.row_index + cell.row_span and
                    cell.col_index <= col < cell.col_index + cell.col_span):
                return cell
        return None

    def iter_rows(self):
        for r in range(self.num_rows):
            yield [self.get_cell(r, c) for c in range(self.num_cols)]


# ---------------------------------------------------------------------------
# Drawings / Vector graphics
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class DrawingElement:
    """A vector drawing or shape on the page."""
    svg_path: str = ""               # SVG path data
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    fill_color: Color | None = None
    stroke_color: Color | None = None
    stroke_width: float = 1.0
    opacity: float = 1.0
    raw_commands: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Layout region (from AI layout detection)
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class LayoutRegion:
    """A detected layout region on the page."""
    region_type: LayoutRegionType = LayoutRegionType.PARAGRAPH
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    confidence: float = 1.0
    reading_order: int = 0
    column_index: int = 0            # which column this belongs to


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class PageElement:
    """Abstract wrapper for any element on a page, with its position."""
    element_type: ElementType = ElementType.TEXT_BLOCK
    element: TextBlock | ImageElement | TableElement | DrawingElement = field(
        default_factory=TextBlock
    )
    bbox: Rect = field(default_factory=lambda: Rect(0, 0, 0, 0))
    z_order: int = 0
    reading_order: int = 0
    column_index: int = 0
    is_header: bool = False
    is_footer: bool = False
    is_background: bool = False


@dataclass(slots=True)
class Page:
    """A single page of the document."""
    page_number: int = 0
    width: float = 612.0             # pts (8.5" = 612pt)
    height: float = 792.0            # pts (11" = 792pt)
    rotation: int = 0                # degrees
    page_type: PageType = PageType.DIGITAL
    elements: list[PageElement] = field(default_factory=list)
    layout_regions: list[LayoutRegion] = field(default_factory=list)

    # Margins detected from content analysis
    margin_top: float = 72.0
    margin_bottom: float = 72.0
    margin_left: float = 72.0
    margin_right: float = 72.0

    # Column layout
    num_columns: int = 1
    column_gap: float = 36.0

    # Headers/footers (shared across pages)
    header_bbox: Rect | None = None
    footer_bbox: Rect | None = None

    # Background
    background_color: Color = field(default_factory=lambda: Color(1.0, 1.0, 1.0))
    background_image: ImageElement | None = None

    @property
    def text_blocks(self) -> list[TextBlock]:
        return [e.element for e in self.elements
                if e.element_type == ElementType.TEXT_BLOCK and isinstance(e.element, TextBlock)]

    @property
    def images(self) -> list[ImageElement]:
        return [e.element for e in self.elements
                if e.element_type == ElementType.IMAGE and isinstance(e.element, ImageElement)]

    @property
    def tables(self) -> list[TableElement]:
        return [e.element for e in self.elements
                if e.element_type == ElementType.TABLE and isinstance(e.element, TableElement)]

    @property
    def drawings(self) -> list[DrawingElement]:
        return [e.element for e in self.elements
                if e.element_type == ElementType.DRAWING and isinstance(e.element, DrawingElement)]


# ---------------------------------------------------------------------------
# Document (top-level)
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class DocumentMetadata:
    """PDF metadata."""
    title: str = ""
    author: str = ""
    subject: str = ""
    creator: str = ""
    producer: str = ""
    creation_date: str = ""
    modification_date: str = ""
    keywords: list[str] = field(default_factory=list)
    page_count: int = 0
    file_size: int = 0


@dataclass(slots=True)
class FontMapping:
    """Mapping from PDF font name to system font name."""
    pdf_name: str = ""
    matched_name: str = ""
    is_exact_match: bool = False
    is_embedded: bool = False
    embedded_data: bytes | None = None
    fallback_name: str = "Arial"


@dataclass(slots=True)
class Document:
    """Complete internal representation of a PDF document."""
    pages: list[Page] = field(default_factory=list)
    metadata: DocumentMetadata = field(default_factory=DocumentMetadata)
    font_map: dict[str, FontMapping] = field(default_factory=dict)
    source_path: str = ""

    @property
    def page_count(self) -> int:
        return len(self.pages)

    def get_all_text(self) -> str:
        parts: list[str] = []
        for page in self.pages:
            for block in page.text_blocks:
                parts.append(block.text)
        return "\n\n".join(parts)

    def get_all_tables(self) -> list[TableElement]:
        tables: list[TableElement] = []
        for page in self.pages:
            tables.extend(page.tables)
        return tables

    def get_all_images(self) -> list[ImageElement]:
        images: list[ImageElement] = []
        for page in self.pages:
            images.extend(page.images)
        return images
