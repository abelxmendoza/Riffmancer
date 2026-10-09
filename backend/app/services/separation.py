from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
import zipfile
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol, cast

from app.schemas import SeparationJob, StemMetadata, StemName
from app.services.audio import AudioValidationError, inspect_audio
from app.services.project_repository import ProjectRepository

STEM_NAMES: tuple[StemName, ...] = ("vocals", "drums", "bass", "other")
STEM_LABELS: dict[StemName, str] = {"vocals": "Vocals", "drums": "Drums", "bass": "Bass", "other": "Other"}


class SeparationError(RuntimeError):
    code = "separation_failed"


class SeparationDependencyError(SeparationError):
    code = "demucs_unavailable"


class ModelDownloadError(SeparationError):
    code = "model_download_failed"


class ActiveSeparationError(SeparationError):
    code = "separation_already_active"


class SeparationQueueFullError(SeparationError):
    code = "separation_queue_full"


class SeparationJobNotFoundError(LookupError):
    pass


StageReporter = Callable[[str], None]


class SeparationProvider(Protocol):
    name: str

    def separate(self, source: Path, output_dir: Path, report_stage: StageReporter) -> dict[StemName, Path]: ...


class DemucsSeparationProvider:
    name = "demucs-htdemucs"

    def available(self) -> bool:
        try:
            result = subprocess.run(
                [sys.executable, "-c", "import demucs"], capture_output=True, text=True, timeout=15, check=False
            )
        except (OSError, subprocess.TimeoutExpired):
            return False
        return result.returncode == 0

    def separate(self, source: Path, output_dir: Path, report_stage: StageReporter) -> dict[StemName, Path]:
        if not self.available():
            raise SeparationDependencyError(
                "Demucs is not installed in the backend environment. Install the optional separation dependencies first."
            )
        report_stage("Loading the Demucs htdemucs model")
        command = [sys.executable, "-m", "demucs", "--name", "htdemucs", "--out", str(output_dir), str(source)]
        report_stage("Separating vocals, drums, bass, and other")
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=60 * 60, check=False)
        except subprocess.TimeoutExpired as exc:
            raise SeparationError("Demucs exceeded the one-hour processing limit.") from exc
        except OSError as exc:
            raise SeparationDependencyError(f"Demucs could not start: {exc}") from exc
        if result.returncode != 0:
            details = (result.stderr or result.stdout or "Demucs exited without details.").strip()[-2000:]
            lowered = details.lower()
            if any(token in lowered for token in ("download", "connection", "urlopen", "name resolution", "certificate", "http error", "network")):
                raise ModelDownloadError(f"Demucs could not download or load its model: {details}")
            raise SeparationError(f"Demucs failed: {details}")
        report_stage("Validating separated WAV files")
        found: dict[StemName, Path] = {}
        for stem_name in STEM_NAMES:
            matches = list(output_dir.rglob(f"{stem_name}.wav"))
            if len(matches) != 1:
                raise SeparationError(f"Demucs did not produce exactly one {stem_name}.wav output.")
            found[stem_name] = matches[0]
        return found


class SeparationManager:
    def __init__(self, projects: ProjectRepository, provider: SeparationProvider, queue_size: int = 8) -> None:
        self.projects = projects
        self.provider = provider
        self._queue: queue.Queue[tuple[str, str] | None] = queue.Queue(maxsize=queue_size)
        self._lock = threading.RLock()
        self._closed = False
        self._recover_unfinished_jobs()
        self._worker = threading.Thread(target=self._work, name="riffmancer-separation", daemon=True)
        self._worker.start()

    def start(self, project_id: str) -> SeparationJob:
        project = self.projects.get(project_id)
        with self._lock:
            current = self._read_job(project.id, required=False)
            if current and current.status in ("queued", "running"):
                raise ActiveSeparationError("A separation job is already queued or running for this project.")
            job = SeparationJob(
                id=str(uuid.uuid4()), project_id=project.id, provider=self.provider.name, status="queued",
                stage="Waiting for the separation worker", created_at=datetime.now(UTC),
            )
            self._write_job(job)
            try:
                self._queue.put_nowait((project.id, job.id))
            except queue.Full as exc:
                job.status = "failed"
                job.stage = "Queue is full"
                job.error_code = SeparationQueueFullError.code
                job.error_message = "The local separation queue is full. Try again after another job finishes."
                job.finished_at = datetime.now(UTC)
                self._write_job(job)
                raise SeparationQueueFullError(job.error_message) from exc
            return job

    def get(self, project_id: str) -> SeparationJob:
        self.projects.get(project_id)
        result = self._read_job(project_id, required=True)
        return cast(SeparationJob, result)

    def stem_path(self, project_id: str, stem_name: str) -> tuple[SeparationJob, Path]:
        if stem_name not in STEM_NAMES:
            raise SeparationJobNotFoundError(stem_name)
        job = self.get(project_id)
        typed_name = cast(StemName, stem_name)
        if job.status != "completed" or typed_name not in job.stems:
            raise SeparationJobNotFoundError(stem_name)
        metadata = job.stems[typed_name]
        output_dir = self.projects.project_dir(project_id) / "derived" / "stems" / job.id
        path = (output_dir / metadata.filename).resolve()
        if path.parent != output_dir.resolve() or not path.is_file():
            raise SeparationJobNotFoundError(stem_name)
        return job, path

    def zip_path(self, project_id: str) -> Path:
        job = self.get(project_id)
        if job.status != "completed" or set(job.stems) != set(STEM_NAMES):
            raise SeparationJobNotFoundError(project_id)
        project_dir = self.projects.project_dir(project_id)
        archive = project_dir / "exports" / f"stems-{job.id}.zip"
        if archive.is_file():
            return archive
        temporary = archive.with_suffix(".zip.tmp")
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED) as bundle:
            for stem_name in STEM_NAMES:
                _, path = self.stem_path(project_id, stem_name)
                bundle.write(path, arcname=f"{stem_name}.wav")
        temporary.replace(archive)
        return archive

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            self._queue.put_nowait(None)
        except queue.Full:
            return
        self._worker.join(timeout=2)

    def _work(self) -> None:
        while True:
            item = self._queue.get()
            try:
                if item is None:
                    return
                self._run(*item)
            finally:
                self._queue.task_done()

    def _run(self, project_id: str, job_id: str) -> None:
        with self._lock:
            job = cast(SeparationJob, self._read_job(project_id, required=True))
            if job.id != job_id or job.status != "queued":
                return
            job.status = "running"
            job.stage = "Preparing source audio"
            job.started_at = datetime.now(UTC)
            self._write_job(job)
        project = self.projects.get(project_id)
        source = self.projects.audio_path(project)
        project_dir = self.projects.project_dir(project_id)
        staging_parent = project_dir / "derived"
        try:
            with tempfile.TemporaryDirectory(prefix=".separation-", dir=staging_parent) as temporary_name:
                temporary = Path(temporary_name)

                def report_stage(stage: str) -> None:
                    with self._lock:
                        current = cast(SeparationJob, self._read_job(project_id, required=True))
                        if current.id == job_id and current.status == "running":
                            current.stage = stage
                            current.progress = None
                            self._write_job(current)

                outputs = self.provider.separate(source, temporary / "provider", report_stage)
                if set(outputs) != set(STEM_NAMES):
                    raise SeparationError("The separation provider did not return all four required stems.")
                report_stage("Publishing verified stem files")
                published = staging_parent / "stems" / job_id
                published.mkdir(parents=True, exist_ok=False)
                stems: dict[StemName, StemMetadata] = {}
                try:
                    for stem_name in STEM_NAMES:
                        source_stem = outputs[stem_name].resolve()
                        if temporary.resolve() not in source_stem.parents or not source_stem.is_file():
                            raise SeparationError(f"The provider returned an unsafe {stem_name} output path.")
                        destination = published / f"{stem_name}.wav"
                        shutil.copyfile(source_stem, destination)
                        stems[stem_name] = StemMetadata(
                            name=stem_name, label=STEM_LABELS[stem_name], filename=destination.name,
                            audio=inspect_audio(destination),
                        )
                except Exception:
                    shutil.rmtree(published, ignore_errors=True)
                    raise
                with self._lock:
                    completed = cast(SeparationJob, self._read_job(project_id, required=True))
                    completed.status = "completed"
                    completed.stage = "Four stems are ready"
                    completed.finished_at = datetime.now(UTC)
                    completed.stems = stems
                    self._write_job(completed)
        except Exception as exc:
            with self._lock:
                failed = cast(SeparationJob, self._read_job(project_id, required=True))
                failed.status = "failed"
                failed.stage = "Separation failed"
                failed.finished_at = datetime.now(UTC)
                failed.error_code = exc.code if isinstance(exc, SeparationError) else "processing_failed"
                failed.error_message = str(exc) if isinstance(exc, (SeparationError, AudioValidationError)) else f"Stem processing failed: {exc}"
                self._write_job(failed)

    def _job_path(self, project_id: str) -> Path:
        return self.projects.project_dir(project_id) / "separation" / "job.json"

    def _read_job(self, project_id: str, required: bool) -> SeparationJob | None:
        path = self._job_path(project_id)
        if not path.is_file():
            if required:
                raise SeparationJobNotFoundError(project_id)
            return None
        try:
            return SeparationJob.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            if required:
                raise SeparationJobNotFoundError(project_id) from exc
            return None

    def _write_job(self, job: SeparationJob) -> None:
        path = self._job_path(job.project_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(job.model_dump(mode="json"), indent=2), encoding="utf-8")
        os.replace(temporary, path)

    def _recover_unfinished_jobs(self) -> None:
        for project in self.projects.list():
            job = self._read_job(project.id, required=False)
            if job and job.status in ("queued", "running"):
                job.status = "interrupted"
                job.stage = "Interrupted when Riffmancer stopped"
                job.error_code = "process_interrupted"
                job.error_message = "The app stopped before separation finished. Start the job again."
                job.finished_at = datetime.now(UTC)
                self._write_job(job)
