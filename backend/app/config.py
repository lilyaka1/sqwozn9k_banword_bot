import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/sqwoz_games"
    
    # Telegram
    telegram_bot_token: str = ""
    
    # JWT
    jwt_secret: str = "change-this-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # Admin
    admin_password: str = "sqwoz2024"
    
    # Ban multipliers
    ban_lottery_multiplier: int = 2
    ban_weekly_word_multiplier: int = 4
    ban_personal_word_multiplier: int = 4
    
    # Economy
    starting_balance: int = 1000
    base_buyout_price: int = 100
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
