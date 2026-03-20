"""SQLite-backed task store for async conversion jobs.

A shared SQLite database (WAL mode) lets all uvicorn workers — which all
run inside the same container — read and write task state without an
external service.  The DB file lives in the same temp directory used for
PDF uploads so no extra volume is needed.

Schema:
  tasks(task_id TEXT PK, meta TEXT, result_data BLOB, created_at REAL)
"""

import json
import logging
import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Optional

import aiosqlite

logger = logging.getLogger(__name__)

_TASK_TTL = 600  # seconds

_DB_PATH = os.path.join(
    os.environ.get(
        "TASK_DB_DIR",
        os.path.join(tempfile.gettempdir(), "pdf_suite_temp"),
    ),
    "tasks.db",
)

_CREATE_TABLE = """
    CREATE TABLE IF NOT EXISTS tasks (
        task_id     TEXT PRIMARY KEY,
        meta        TEXT NOT NULL,
        result_data BLOB,
        created_at  REAL NOT NULL
    )
"""


@asynccontextmanager
async def _db():
    """Async context manager: open a WAL-mode connection, ensure schema."""
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    async with aiosqlite.connect(_DB_PATH, timeout=15) as conn:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA synchronous=NORMAL")
        await conn.execute(_CREATE_TABLE)
        await conn.commit()
        yield conn


@dataclass
class ConversionTask:
    task_id: str
    status: str = "pending"       # pending | processing | complete | error
    progress: int = 0             # 0-100
    current_page: int = 0
    total_pages: int = 0
    message: str = ""
    result_filename: str = ""
    result_media_type: str = ""
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    # Loaded on-demand by load_task_result(); not stored in meta JSON.
    result_data: Optional[bytes] = field(default=None, repr=False)

    async def update(self, **kwargs) -> None:
        """Apply kwargs to this object and persist to SQLite atomically."""
        result_data = kwargs.pop("result_data", None)
        for k, v in kwargs.items():
            setattr(self, k, v)

        meta = json.dumps({
            "task_id": self.task_id,
            "status": self.status,
            "progress": self.progress,
            "current_page": self.current_page,
            "total_pages": self.total_pages,
            "message": self.message,
            "result_filename": self.result_filename,
            "result_media_type": self.result_media_type,
            "error": self.error,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        })
        async with _db() as conn:
            await conn.execute(
                """
                INSERT INTO tasks(task_id, meta, result_data, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    meta        = excluded.meta,
                    result_data = COALESCE(excluded.result_data, tasks.result_data)
                """,
                (self.task_id, meta, result_data, self.created_at),
            )
            await conn.commit()
        if result_data is not None:
            self.result_data = result_data


async def create_task(**initial_fields) -> "ConversionTask":
    """Create, persist, and return a new task; prune stale ones."""
    task = ConversionTask(task_id=uuid.uuid4().hex[:12], **initial_fields)
    await task.update()
    await _purge_stale()
    return task


async def get_task(task_id: str) -> Optional[ConversionTask]:
    """Load task metadata from SQLite; returns None if not found."""
    async with _db() as conn:
        async with conn.execute(
            "SELECT meta FROM tasks WHERE task_id = ?", (task_id,)
        ) as cur:
            row = await cur.fetchone()
    if not row:
        return None
    return ConversionTask(**json.loads(row[0]))


async def load_task_result(task: ConversionTask) -> None:
    """Populate task.result_data from SQLite (call before download)."""
    async with _db() as conn:
        async with conn.execute(
            "SELECT result_data FROM tasks WHERE task_id = ?", (task.task_id,)
        ) as cur:
            row = await cur.fetchone()
    task.result_data = row[0] if row else None


async def remove_task(task_id: str) -> None:
    """Delete a task row from SQLite."""
    async with _db() as conn:
        await conn.execute("DELETE FROM tasks WHERE task_id = ?", (task_id,))
        await conn.commit()


async def _purge_stale() -> None:
    """Delete tasks older than TTL."""
    cutoff = time.time() - _TASK_TTL
    async with _db() as conn:
        await conn.execute("DELETE FROM tasks WHERE created_at < ?", (cutoff,))
        await conn.commit()
