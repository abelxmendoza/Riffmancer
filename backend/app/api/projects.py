from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.schemas import Project
from app.services.audio import AudioValidationError
from app.services.project_repository import ProjectNotFoundError, ProjectRepository, UploadTooLargeError

router = APIRouter(prefix="/api/projects", tags=["projects"])


def repository(request: Request) -> ProjectRepository:
    return request.app.state.projects


@router.get("", response_model=list[Project])
def list_projects(request: Request) -> list[Project]:
    return repository(request).list()


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str, request: Request) -> Project:
    try:
        return repository(request).get(project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Project not found.") from exc


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(request: Request, file: UploadFile) -> Project:
    try:
        return await repository(request).create(file)
    except UploadTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except AudioValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{project_id}/audio", response_class=FileResponse)
def stream_audio(project_id: str, request: Request) -> FileResponse:
    try:
        project = repository(request).get(project_id)
        path = repository(request).audio_path(project)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Project audio not found.") from exc
    return FileResponse(path, media_type=project.content_type, filename=project.original_filename, content_disposition_type="inline")

