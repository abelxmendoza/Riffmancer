from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from app.schemas import AudioMetadata


class AudioValidationError(ValueError):
    pass


SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg"}


def ffprobe_available() -> bool:
    return shutil.which("ffprobe") is not None


def inspect_audio(path: Path) -> AudioMetadata:
    if not ffprobe_available():
        raise RuntimeError("FFprobe is not installed or not available on PATH.")

    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,format_name,bit_rate,size:stream=codec_type,codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if result.returncode != 0:
        raise AudioValidationError("The file is not readable audio or its media container is damaged.")

    try:
        payload = json.loads(result.stdout)
        stream = next(item for item in payload.get("streams", []) if item.get("codec_type") == "audio")
        media_format = payload["format"]
        duration = float(media_format.get("duration", 0))
        channels = int(stream.get("channels", 0))
    except (json.JSONDecodeError, KeyError, StopIteration, TypeError, ValueError) as exc:
        raise AudioValidationError("No valid audio stream was found in this file.") from exc

    if duration <= 0 or channels <= 0:
        raise AudioValidationError("The audio stream has no playable duration or channels.")

    bit_rate_raw = media_format.get("bit_rate")
    return AudioMetadata(
        duration_seconds=round(duration, 3),
        format_name=str(media_format.get("format_name", "unknown")),
        codec_name=str(stream.get("codec_name", "unknown")),
        sample_rate=int(stream.get("sample_rate") or 0),
        channels=channels,
        bit_rate=int(bit_rate_raw) if bit_rate_raw else None,
        size_bytes=path.stat().st_size,
    )

