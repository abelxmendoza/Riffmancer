from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.projects import router as projects_router
from app.api.separation import router as separation_router
from app.config import Settings
from app.services.audio import ffprobe_available
from app.services.project_repository import ProjectRepository
from app.services.separation import DemucsSeparationProvider, SeparationManager, SeparationProvider


def create_app(
    settings: Settings | None = None,
    separation_provider: SeparationProvider | None = None,
) -> FastAPI:
    active_settings = settings or Settings.from_environment()
    projects = ProjectRepository(active_settings.data_dir, active_settings.max_upload_bytes)
    separation = SeparationManager(
        projects,
        separation_provider or DemucsSeparationProvider(),
        active_settings.separation_queue_size,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        separation.close()

    app = FastAPI(title="Riffmancer API", version="0.2.0", lifespan=lifespan)
    app.state.projects = projects
    app.state.separation = separation
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(projects_router)
    app.include_router(separation_router)

    @app.get("/health")
    def health() -> dict[str, str | bool]:
        available = ffprobe_available()
        return {"status": "ok" if available else "degraded", "ffprobe": available}

    return app


app = create_app()
