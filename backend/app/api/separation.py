from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse

from app.schemas import SeparationJob
from app.services.project_repository import ProjectNotFoundError
from app.services.separation import (
    ActiveSeparationError,
    SeparationJobNotFoundError,
    SeparationManager,
    SeparationQueueFullError,
)

router = APIRouter(prefix="/api/projects/{project_id}/separation", tags=["separation"])


def manager(request: Request) -> SeparationManager:
    return request.app.state.separation


@router.post("", response_model=SeparationJob, status_code=status.HTTP_202_ACCEPTED)
def start_separation(project_id: str, request: Request) -> SeparationJob:
    try:
        return manager(request).start(project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Project not found.") from exc
    except ActiveSeparationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SeparationQueueFullError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("", response_model=SeparationJob)
def get_separation(project_id: str, request: Request) -> SeparationJob:
    try:
        return manager(request).get(project_id)
    except (ProjectNotFoundError, SeparationJobNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="No separation job exists for this project.") from exc


@router.get("/stems/{stem_name}", response_class=FileResponse)
def get_stem(project_id: str, stem_name: str, request: Request, download: bool = False) -> FileResponse:
    try:
        _, path = manager(request).stem_path(project_id, stem_name)
    except (ProjectNotFoundError, SeparationJobNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Stem audio is not available.") from exc
    return FileResponse(
        path, media_type="audio/wav", filename=f"{stem_name}.wav",
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/download", response_class=FileResponse)
def download_stems(project_id: str, request: Request) -> FileResponse:
    try:
        path = manager(request).zip_path(project_id)
    except (ProjectNotFoundError, SeparationJobNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Completed stems are not available.") from exc
    return FileResponse(path, media_type="application/zip", filename="riffmancer-stems.zip")
