from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AudioMetadata(BaseModel):
    duration_seconds: float = Field(ge=0)
    format_name: str
    codec_name: str
    sample_rate: int = Field(ge=0)
    channels: int = Field(ge=1)
    bit_rate: int | None = Field(default=None, ge=0)
    size_bytes: int = Field(ge=0)


class Project(BaseModel):
    id: str
    title: str
    original_filename: str
    stored_filename: str
    content_type: str
    sha256: str
    created_at: datetime
    audio: AudioMetadata

