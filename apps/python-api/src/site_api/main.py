import secrets
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_token: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def settings() -> Settings:
    return Settings()


bearer = HTTPBearer(auto_error=False, scheme_name="ServiceBearer")


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


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["python-api"]


class ReviewResponse(BaseModel):
    content_id: str
    version: int
    decision: Literal["human"]
    reason: str


class ServiceError(BaseModel):
    detail: str


review_example = {"content_id": "example", "version": 1, "text": "待审核内容"}
review_reason = "AI provider not configured; manual review required"

app = FastAPI(
    title="Python 服务接口",
    version="0.1.0",
    description="已实现的服务间接口。",
    servers=[{"url": "http://localhost:8000", "description": "本地开发"}],
    openapi_tags=[{"name": "基础"}, {"name": "审核"}],
)


@app.get(
    "/health",
    operation_id="getPythonHealth",
    summary="检查 Python 服务",
    tags=["基础"],
    response_model=HealthResponse,
    openapi_extra={"security": []},
    responses={
        200: {
            "content": {
                "application/json": {"example": {"status": "ok", "service": "python-api"}}
            }
        }
    },
)
def health():
    return {"status": "ok", "service": "python-api"}


@app.post(
    "/v1/moderation",
    operation_id="reviewContent",
    summary="提交指定版本的内容审核",
    description="当前返回人工审核决定。调用方负责保存审核结果。",
    tags=["审核"],
    dependencies=[Depends(require_service)],
    response_model=ReviewResponse,
    openapi_extra={
        "responses": {
            "422": {
                "content": {
                    "application/json": {
                        "example": {
                            "detail": [
                                {"loc": ["body", "version"], "msg": "Field required", "type": "missing"}
                            ]
                        }
                    }
                }
            }
        }
    },
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "content_id": "example",
                        "version": 1,
                        "decision": "human",
                        "reason": review_reason,
                    }
                }
            }
        },
        401: {
            "model": ServiceError,
            "description": "服务令牌缺失或无效",
            "content": {"application/json": {"example": {"detail": "Unauthorized"}}},
        },
        503: {
            "model": ServiceError,
            "description": "服务令牌未配置",
            "content": {
                "application/json": {"example": {"detail": "Service authentication not configured"}}
            },
        },
    },
)
def moderate(
    payload: Annotated[ReviewRequest, Body(openapi_examples={"review": {"value": review_example}})]
):
    # Foundation contract: never simulate AI approval. Provider adapter is pending.
    return {
        "content_id": payload.content_id,
        "version": payload.version,
        "decision": "human",
        "reason": review_reason,
    }
