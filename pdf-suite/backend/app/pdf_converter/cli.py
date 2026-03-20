"""CLI interface for the PDF converter."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from app.pdf_converter.config import (
    DocxLayoutMode, OutputFormat, PipelineConfig,
)
from app.pdf_converter.pipeline import ConversionPipeline

console = Console()


def _setup_logging(level: str):
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True)],
    )


@click.command()
@click.argument("pdf_path", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-f", "--format",
    "output_format",
    type=click.Choice(["docx", "xlsx", "pptx"], case_sensitive=False),
    default="docx",
    help="Output format.",
)
@click.option("-o", "--output", "output_path", type=click.Path(), default=None,
              help="Output file path. Auto-generated if omitted.")
@click.option("--pages", type=str, default=None,
              help="Page range, e.g., '1-5' or '1,3,5'. Default: all pages.")
@click.option("--layout-mode",
              type=click.Choice(["flow", "fixed", "auto"]),
              default="auto",
              help="DOCX layout mode.")
@click.option("--cpu-enhanced", is_flag=True, default=False,
              help="Enable CPU-optimized defaults.")
@click.option("--cpu-profile",
              type=click.Choice(["balanced"], case_sensitive=False),
              default="balanced",
              help="CPU profile when --cpu-enhanced is set.")
@click.option("--dpi", type=int, default=300,
              help="DPI for image extraction.")
@click.option("--debug", is_flag=True, default=False,
              help="Enable debug output (save intermediate results).")
@click.option("--log-level",
              type=click.Choice(["DEBUG", "INFO", "WARNING", "ERROR"]),
              default="INFO",
              help="Logging level.")
def main(
    pdf_path: str,
    output_format: str,
    output_path: str | None,
    pages: str | None,
    layout_mode: str,
    cpu_enhanced: bool,
    cpu_profile: str,
    dpi: int,
    debug: bool,
    log_level: str,
):
    """Convert PDF to DOCX, XLSX, or PPTX with pixel-perfect accuracy.

    PDF_PATH: Path to the input PDF file.
    """
    _setup_logging(log_level)

    # Build config
    config = PipelineConfig(
        output_format=OutputFormat(output_format.lower()),
        debug_output=debug,
        log_level=log_level,
    )

    # DOCX layout mode
    mode_map = {
        "flow": DocxLayoutMode.FLOW,
        "fixed": DocxLayoutMode.FIXED,
        "auto": DocxLayoutMode.AUTO,
    }
    config.docx.layout_mode = mode_map[layout_mode]
    config.docx.image_dpi = dpi

    if cpu_enhanced:
        config.apply_cpu_profile()
        os.environ.setdefault("OMP_NUM_THREADS", str(config.cpu_threads))
        os.environ.setdefault("MKL_NUM_THREADS", str(config.cpu_threads))

    # Page range
    if pages:
        config.page_range = _parse_page_range(pages)

    # Auto-generate output path
    if output_path is None:
        output_path = str(
            Path(pdf_path).with_suffix(f".{output_format.lower()}")
        )

    # Run conversion
    console.print(f"\n[bold blue]PDF Converter[/bold blue]")
    console.print(f"  Input:  {pdf_path}")
    console.print(f"  Output: {output_path}")
    console.print(f"  Format: {output_format.upper()}")
    if cpu_enhanced:
        console.print("  CPU profile: balanced")
    console.print()

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("Converting...", total=None)
            pipeline = ConversionPipeline(config)
            result_path = pipeline.convert(pdf_path, output_path)
            progress.update(task, description="[green]Done!")

        console.print(f"\n[bold green]✓[/bold green] Saved to: {result_path}")

    except Exception as e:
        console.print(f"\n[bold red]✗ Error:[/bold red] {e}")
        if log_level == "DEBUG":
            console.print_exception()
        sys.exit(1)


def _parse_page_range(pages_str: str) -> tuple[int, int]:
    """Parse page range string like '1-5' into (start, end) 0-indexed tuple."""
    pages_str = pages_str.strip()

    if "-" in pages_str:
        parts = pages_str.split("-", 1)
        start = int(parts[0].strip()) - 1
        end = int(parts[1].strip()) - 1
        return (max(0, start), end)
    elif "," in pages_str:
        # For comma-separated pages, use min-max range
        page_nums = [int(p.strip()) - 1 for p in pages_str.split(",")]
        return (min(page_nums), max(page_nums))
    else:
        page = int(pages_str.strip()) - 1
        return (page, page)


if __name__ == "__main__":
    main()
