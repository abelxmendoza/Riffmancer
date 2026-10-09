from __future__ import annotations

import hashlib
import json
import re
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import UploadFile

from app.schemas import Project
from app.services.audio import AudioValidationError, SUPPORTED_EXTENSIONS, inspect_audio


class UploadTooLargeError(ValueError):
    pass


class ProjectNotFoundError(LookupError):
    pass


def safe_filename(filename: str) -> str:
    base = Path(filename).name.strip()
    cleaned = re.sub(r"[^A-Za-z0-9._ -]+", "_", base).strip(" .")
    return cleaned[:180] or "audio"


class ProjectRepository:
    def __init__(self, data_dir: Path, max_upload_bytes: int) -> None:
        self.projects_dir = data_dir / "projects"
        self.max_upload_bytes = max_upload_bytes
        self.projects_dir.mkdir(parents=True, exist_ok=True)

    def list(self) -> list[Project]:
        projects: list[Project] = []
        for metadata_path in self.projects_dir.glob("*/project.json"):
            try:
                projects.append(Project.model_validate_json(metadata_path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                continue
        return sorted(projects, key=lambda project: project.created_at, reverse=True)

    def get(self, project_id: str) -> Project:
        project_dir = self._project_dir(project_id)
        metadata_path = project_dir / "project.json"
        if not metadata_path.is_file():
            raise ProjectNotFoundError(project_id)
        try:
            return Project.model_validate_json(metadata_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ProjectNotFoundError(project_id) from exc

    def audio_path(self, project: Project) -> Path:
        path = self.project_dir(project.id) / "source" / project.stored_filename
        if not path.is_file():
            raise ProjectNotFoundError(project.id)
        return path

    def project_dir(self, project_id: str) -> Path:
        project_dir = self._project_dir(project_id)
        if not (project_dir / "project.json").is_file():
            raise ProjectNotFoundError(project_id)
        return project_dir

    async def create(self, upload: UploadFile) -> Project:
        original_filename = safe_filename(upload.filename or "audio")
        extension = Path(original_filename).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            allowed = ", ".join(sorted(SUPPORTED_EXTENSIONS))
            raise AudioValidationError(f"Unsupported file type. Choose one of: {allowed}.")

        project_id = str(uuid.uuid4())
        project_dir = self.projects_dir / project_id
        source_dir = project_dir / "source"
        temporary_path = project_dir / ".uploading"
        source_dir.mkdir(parents=True)
        (project_dir / "derived").mkdir()
        (project_dir / "exports").mkdir()

        digest = hashlib.sha256()
        total = 0
        try:
            with temporary_path.open("wb") as target:
                while chunk := await upload.read(1024 * 1024):
                    total += len(chunk)
                    if total > self.max_upload_bytes:
                        raise UploadTooLargeError(
                            f"File exceeds the {self.max_upload_bytes // (1024 * 1024)} MB upload limit."
                        )
                    digest.update(chunk)
                    target.write(chunk)

            metadata = inspect_audio(temporary_path)
            final_path = source_dir / original_filename
            temporary_path.replace(final_path)
            project = Project(
                id=project_id,
                title=Path(original_filename).stem,
                original_filename=original_filename,
                stored_filename=original_filename,
                content_type=upload.content_type or "application/octet-stream",
                sha256=digest.hexdigest(),
                created_at=datetime.now(UTC),
                audio=metadata,
            )
            (project_dir / "project.json").write_text(
                json.dumps(project.model_dump(mode="json"), indent=2), encoding="utf-8"
            )
            return project
        except Exception:
            shutil.rmtree(project_dir, ignore_errors=True)
            raise
        finally:
            await upload.close()

    def _project_dir(self, project_id: str) -> Path:
        try:
            normalized = str(uuid.UUID(project_id))
        except ValueError as exc:
            raise ProjectNotFoundError(project_id) from exc
        return self.projects_dir / normalized
