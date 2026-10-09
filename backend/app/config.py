from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    max_upload_bytes: int = 500 * 1024 * 1024
    separation_queue_size: int = 8

    @classmethod
    def from_environment(cls) -> "Settings":
        default = Path(__file__).resolve().parents[2] / "data"
        return cls(data_dir=Path(os.getenv("RIFFMANCER_DATA_DIR", default)).expanduser().resolve())
