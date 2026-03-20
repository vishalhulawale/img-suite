"""Configuration for the PDF conversion pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class OutputFormat(Enum):
    DOCX = "docx"
    XLSX = "xlsx"
    PPTX = "pptx"


class TableDetectionMethod(Enum):
    LINES = "lines"            # PyMuPDF line analysis only (fast, no external deps)


class LayoutModel(Enum):
    HEURISTIC = "heuristic"    # Fast rule-based analysis (no ML models)


class DocxLayoutMode(Enum):
    FLOW = "flow"              # Normal document flow (best for simple layouts)
    FIXED = "fixed"            # Absolute positioning with text boxes (complex layouts)
    AUTO = "auto"              # Automatically choose per page


@dataclass
class TableConfig:
    detection_method: TableDetectionMethod = TableDetectionMethod.LINES
    min_rows: int = 2
    min_cols: int = 2
    merge_close_lines: float = 3.0   # pts - merge lines within this distance
    detect_borderless: bool = True
    detect_spanning_cells: bool = True
    snap_to_grid: bool = True        # Snap cell boundaries to consistent grid


@dataclass
class LayoutConfig:
    model: LayoutModel = LayoutModel.HEURISTIC
    detect_columns: bool = True
    detect_headers_footers: bool = True
    detect_reading_order: bool = True
    detect_lists: bool = True
    detect_headings: bool = True
    heading_size_ratio: float = 1.2  # Min ratio vs body text to be heading
    column_gap_threshold: float = 20.0  # pts


@dataclass
class DocxConfig:
    layout_mode: DocxLayoutMode = DocxLayoutMode.AUTO
    preserve_exact_fonts: bool = True
    embed_fonts: bool = False
    preserve_line_breaks: bool = True
    preserve_page_breaks: bool = True
    image_dpi: int = 300
    max_image_dimension: int = 4096  # pixels
    map_heading_styles: bool = True
    preserve_background_colors: bool = True


@dataclass
class XlsxConfig:
    one_sheet_per_table: bool = False
    one_sheet_per_page: bool = True
    detect_number_formats: bool = True
    detect_dates: bool = True
    detect_currency: bool = True
    preserve_formatting: bool = True
    auto_column_width: bool = True
    max_column_width: float = 50.0   # characters
    freeze_header_row: bool = True


@dataclass
class PptxConfig:
    one_slide_per_page: bool = True
    match_page_dimensions: bool = True
    preserve_text_positions: bool = True
    image_dpi: int = 300
    use_slide_layouts: bool = False   # Try to map to standard layouts
    background_as_image: bool = False  # Render complex backgrounds as images


@dataclass
class FontConfig:
    font_substitution_map: dict[str, str] = field(default_factory=lambda: {
        # Common PDF fonts -> system equivalents
        "TimesNewRomanPSMT": "Times New Roman",
        "Times-Roman": "Times New Roman",
        "Times-Bold": "Times New Roman",
        "Times-Italic": "Times New Roman",
        "Times-BoldItalic": "Times New Roman",
        "ArialMT": "Arial",
        "Arial-BoldMT": "Arial",
        "Arial-ItalicMT": "Arial",
        "Arial-BoldItalicMT": "Arial",
        "Helvetica": "Arial",
        "Helvetica-Bold": "Arial",
        "Helvetica-Oblique": "Arial",
        "Helvetica-BoldOblique": "Arial",
        "CourierNewPSMT": "Courier New",
        "Courier": "Courier New",
        "Courier-Bold": "Courier New",
        "Courier-Oblique": "Courier New",
        "Symbol": "Symbol",
        "ZapfDingbats": "Wingdings",
        "Calibri": "Calibri",
        "Cambria": "Cambria",
        "Verdana": "Verdana",
        "Georgia": "Georgia",
        "Tahoma": "Tahoma",
        "TrebuchetMS": "Trebuchet MS",
    })
    fallback_serif: str = "Times New Roman"
    fallback_sans: str = "Arial"
    fallback_mono: str = "Courier New"
    extract_embedded: bool = True


@dataclass
class PipelineConfig:
    """Master configuration for the conversion pipeline."""
    output_format: OutputFormat = OutputFormat.DOCX
    table: TableConfig = field(default_factory=TableConfig)
    layout: LayoutConfig = field(default_factory=LayoutConfig)
    docx: DocxConfig = field(default_factory=DocxConfig)
    xlsx: XlsxConfig = field(default_factory=XlsxConfig)
    pptx: PptxConfig = field(default_factory=PptxConfig)
    font: FontConfig = field(default_factory=FontConfig)

    # General settings
    page_range: tuple[int, int] | None = None  # (start, end) 0-indexed, None = all
    use_gpu: bool = False
    num_workers: int = 4
    temp_dir: str = ""
    log_level: str = "INFO"
    debug_output: bool = False        # Save intermediate results for debugging
    debug_dir: str = ""
    cpu_threads: int = 0

    def apply_cpu_profile(self):
        """Apply CPU-oriented defaults for the balanced profile."""
        self.use_gpu = False
        self.layout.model = LayoutModel.HEURISTIC
        if self.cpu_threads <= 0:
            import os
            self.cpu_threads = max(1, min((os.cpu_count() or 4), 8))

    def get_temp_dir(self) -> Path:
        if self.temp_dir:
            return Path(self.temp_dir)
        import tempfile
        return Path(tempfile.mkdtemp(prefix="pdf_converter_"))
