import secrets
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_token: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def settings() -> Settings:
    return Settings()


bearer = HTTPBearer(auto_error=False)


def require_service(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    expected = settings().service_token
    if not expected:
        raise HTTPException(503, "Service authentication not configured")
    if credentials is None or not secrets.compare_digest(credentials.credentials, expected):
        raise HTTPException(401, "Unauthorized")


class ReviewRequest(BaseModel):
    content_id: str = Field(min_length=1, max_length=100)
    version: int = Field(ge=1)
    text: str = Field(max_length=100_000)


app = FastAPI(title="Site review service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "python-api"}


@app.post("/v1/moderation", dependencies=[Depends(require_service)])
def moderate(payload: ReviewRequest):
    # Foundation contract: never simulate AI approval. Provider adapter is pending.
    return {
        "content_id": payload.content_id,
        "version": payload.version,
        "decision": "human",
        "reason": "AI provider not configured; manual review required",
    }
