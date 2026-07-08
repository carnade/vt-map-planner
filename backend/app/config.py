from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    vasttrafik_client_id: str
    vasttrafik_client_secret: str
    vasttrafik_token_url: str = "https://ext-api.vasttrafik.se/token"
    vasttrafik_api_base_url: str = "https://ext-api.vasttrafik.se/pr/v4"
    cors_origins: str = "http://localhost:5173"
    positions_cache_ttl_seconds: float = 2.0
    stops_cache_ttl_seconds: float = 86400.0
    departures_cache_ttl_seconds: float = 10.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
