from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openai_api_key: str
    data_dir: Path = Path("./data")
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4o"
    similarity_top_k: int = 10
    chunk_size: int = 1024
    chunk_overlap: int = 128


@lru_cache
def get_settings() -> Settings:
    return Settings()
