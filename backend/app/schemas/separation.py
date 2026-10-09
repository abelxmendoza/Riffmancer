from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.projects import AudioMetadata

StemName = Literal["vocals", "drums", "bass", "other"]
JobStatus = Literal["queued", "running", "completed", "failed", "interrupted"]


class StemMetadata(BaseModel):
    name: StemName
    label: str
    filename: str
    audio: AudioMetadata


class SeparationJob(BaseModel):
    id: str
    project_id: str
    provider: str
    status: JobStatus
    stage: str
    progress: float | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    stems: dict[StemName, StemMetadata] = Field(default_factory=dict)
