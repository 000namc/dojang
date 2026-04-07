from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_model_high: str = "gpt-5.4-mini"
    db_path: str = "data/dojang.db"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
