from __future__ import annotations

import io
import wave
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def wav_bytes(duration_seconds: float = 0.1, sample_rate: int = 8_000) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(b"\x00\x00" * int(duration_seconds * sample_rate))
    return output.getvalue()


def client(tmp_path: Path, max_upload_bytes: int = 1024 * 1024) -> TestClient:
    return TestClient(create_app(Settings(data_dir=tmp_path, max_upload_bytes=max_upload_bytes)))


def test_health_reports_ffprobe(tmp_path: Path) -> None:
    response = client(tmp_path).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "ffprobe": True}


def test_upload_lists_and_streams_audio(tmp_path: Path) -> None:
    api = client(tmp_path)
    upload = api.post("/api/projects", files={"file": ("First Song.wav", wav_bytes(), "audio/wav")})
    assert upload.status_code == 201
    project = upload.json()
    assert project["title"] == "First Song"
    assert project["audio"]["channels"] == 1
    assert project["audio"]["sample_rate"] == 8_000

    library = api.get("/api/projects")
    assert library.status_code == 200
    assert [item["id"] for item in library.json()] == [project["id"]]

    audio = api.get(f"/api/projects/{project['id']}/audio")
    assert audio.status_code == 200
    assert audio.content.startswith(b"RIFF")

    partial = api.get(f"/api/projects/{project['id']}/audio", headers={"Range": "bytes=0-15"})
    assert partial.status_code == 206
    assert partial.headers["content-range"].startswith("bytes 0-15/")
    assert len(partial.content) == 16


def test_invalid_audio_is_rejected_without_leaving_a_project(tmp_path: Path) -> None:
    api = client(tmp_path)
    response = api.post("/api/projects", files={"file": ("fake.mp3", b"not audio", "audio/mpeg")})
    assert response.status_code == 422
    assert "not readable audio" in response.json()["detail"]
    assert api.get("/api/projects").json() == []


def test_unsupported_extension_is_rejected(tmp_path: Path) -> None:
    response = client(tmp_path).post(
        "/api/projects", files={"file": ("notes.txt", b"hello", "text/plain")}
    )
    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_limit_is_enforced(tmp_path: Path) -> None:
    response = client(tmp_path, max_upload_bytes=32).post(
        "/api/projects", files={"file": ("large.wav", wav_bytes(), "audio/wav")}
    )
    assert response.status_code == 413
    assert client(tmp_path).get("/api/projects").json() == []
