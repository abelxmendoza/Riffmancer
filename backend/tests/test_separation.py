from __future__ import annotations

import io
import json
import shutil
import threading
import time
import wave
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import SeparationJob, StemName
from app.services.separation import (
    DemucsSeparationProvider,
    SeparationDependencyError,
    SeparationError,
    StageReporter,
    STEM_NAMES,
)


def wav_bytes(duration_seconds: float = 0.1, sample_rate: int = 8_000) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(b"\x00\x00" * int(duration_seconds * sample_rate))
    return output.getvalue()


class FakeProvider:
    name = "fake-separator"

    def __init__(self, gate: threading.Event | None = None, failure: str | None = None) -> None:
        self.gate = gate
        self.failure = failure
        self.started = threading.Event()

    def separate(self, source: Path, output_dir: Path, report_stage: StageReporter) -> dict[StemName, Path]:
        self.started.set()
        report_stage("Fake provider is separating")
        if self.gate is not None and not self.gate.wait(timeout=5):
            raise SeparationError("Fake provider timed out.")
        if self.failure:
            raise SeparationError(self.failure)
        output_dir.mkdir(parents=True, exist_ok=True)
        outputs: dict[StemName, Path] = {}
        for stem_name in STEM_NAMES:
            destination = output_dir / f"{stem_name}.wav"
            shutil.copyfile(source, destination)
            outputs[stem_name] = destination
        return outputs


def upload(api: TestClient, name: str = "song.wav") -> dict:
    response = api.post("/api/projects", files={"file": (name, wav_bytes(), "audio/wav")})
    assert response.status_code == 201
    return response.json()


def wait_for_status(api: TestClient, project_id: str, status: str, timeout: float = 5) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = api.get(f"/api/projects/{project_id}/separation")
        if response.status_code == 200 and response.json()["status"] == status:
            return response.json()
        time.sleep(0.02)
    raise AssertionError(f"Job did not reach {status}")


def test_job_transitions_downloads_and_project_isolation(tmp_path: Path) -> None:
    gate = threading.Event()
    provider = FakeProvider(gate=gate)
    app = create_app(Settings(data_dir=tmp_path), provider)
    with TestClient(app) as api:
        first = upload(api, "first.wav")
        second = upload(api, "second.wav")
        started = api.post(f"/api/projects/{first['id']}/separation")
        assert started.status_code == 202
        assert started.json()["status"] == "queued"
        assert provider.started.wait(timeout=2)

        running = wait_for_status(api, first["id"], "running")
        assert running["progress"] is None
        deadline = time.monotonic() + 2
        while running["stage"] != "Fake provider is separating" and time.monotonic() < deadline:
            running = api.get(f"/api/projects/{first['id']}/separation").json()
            time.sleep(0.01)
        assert running["stage"] == "Fake provider is separating"
        duplicate = api.post(f"/api/projects/{first['id']}/separation")
        assert duplicate.status_code == 409

        gate.set()
        completed = wait_for_status(api, first["id"], "completed")
        assert set(completed["stems"]) == set(STEM_NAMES)

        stem = api.get(f"/api/projects/{first['id']}/separation/stems/bass", headers={"Range": "bytes=0-15"})
        assert stem.status_code == 206
        assert stem.content.startswith(b"RIFF")
        download = api.get(f"/api/projects/{first['id']}/separation/stems/bass?download=true")
        assert download.headers["content-disposition"].startswith("attachment")
        archive = api.get(f"/api/projects/{first['id']}/separation/download")
        assert archive.status_code == 200
        assert archive.content.startswith(b"PK")

        assert api.get(f"/api/projects/{second['id']}/separation/stems/bass").status_code == 404
        assert api.get(f"/api/projects/{first['id']}/separation/stems/../../source/first.wav").status_code == 404


def test_provider_failure_is_persisted_with_useful_message(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path), FakeProvider(failure="Model weights are unavailable."))
    with TestClient(app) as api:
        project = upload(api)
        assert api.post(f"/api/projects/{project['id']}/separation").status_code == 202
        failed = wait_for_status(api, project["id"], "failed")
        assert failed["error_code"] == "separation_failed"
        assert failed["error_message"] == "Model weights are unavailable."
        assert failed["stems"] == {}


def test_unfinished_job_is_marked_interrupted_on_restart(tmp_path: Path) -> None:
    initial = create_app(Settings(data_dir=tmp_path), FakeProvider())
    with TestClient(initial) as api:
        project = upload(api)

    job = SeparationJob(
        id="be02862e-9097-4e0a-b492-8d654f547378",
        project_id=project["id"],
        provider="old-provider",
        status="running",
        stage="Separating",
        created_at=datetime.now(UTC),
    )
    job_path = tmp_path / "projects" / project["id"] / "separation" / "job.json"
    job_path.parent.mkdir(parents=True)
    job_path.write_text(json.dumps(job.model_dump(mode="json")), encoding="utf-8")

    restarted = create_app(Settings(data_dir=tmp_path), FakeProvider())
    with TestClient(restarted) as api:
        recovered = api.get(f"/api/projects/{project['id']}/separation")
        assert recovered.status_code == 200
        assert recovered.json()["status"] == "interrupted"
        assert recovered.json()["error_code"] == "process_interrupted"


def test_demucs_provider_reports_missing_optional_dependency(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    provider = DemucsSeparationProvider()
    monkeypatch.setattr(provider, "available", lambda: False)
    with pytest.raises(SeparationDependencyError, match="optional separation dependencies"):
        provider.separate(tmp_path / "source.wav", tmp_path / "output", lambda _: None)
