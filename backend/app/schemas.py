from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# === Player Schemas ===

class PlayerBase(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerResponse(PlayerBase):
    id: int
    balance: int
    ban_count: int
    current_buyout_price: int
    is_banned: bool
    ban_expires_at: Optional[datetime] = None
    last_ban_reason: Optional[str] = None
    last_ban_word: Optional[str] = None
    personal_banwords: List[str] = []
    games_played: int
    games_won: int
    created_at: datetime
    last_active_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PlayerPublic(BaseModel):
    """Публичная информация об игроке"""
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    balance: int
    games_played: int
    is_banned: bool
    
    class Config:
        from_attributes = True


class PlayerUpdate(BaseModel):
    balance: Optional[int] = None
    personal_banwords: Optional[List[str]] = None


# === Leaderboard Schemas ===

class LeaderboardEntry(BaseModel):
    """Запись в лидерборде"""
    rank: int
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    balance: int
    total_wins: int = 0
    
    class Config:
        from_attributes = True


# === Auth Schemas ===

class TelegramAuthData(BaseModel):
    """Данные авторизации из Telegram WebApp"""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    player: PlayerResponse


# === Ban Schemas ===

class BanReason:
    LOTTERY = "lottery"
    WEEKLY_WORD = "weekly_word"
    PERSONAL_WORD = "personal_word"
    GLOBAL_WORD = "global_word"
    MANUAL = "manual"


class BanCreate(BaseModel):
    player_id: int
    reason: str
    word: Optional[str] = None


class BanHistoryResponse(BaseModel):
    id: int
    reason: str
    word: Optional[str] = None
    multiplier: int
    buyout_price: int
    was_paid: bool
    duration_hours: int
    expires_at: datetime
    created_at: datetime
    paid_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class BuyoutRequest(BaseModel):
    """Запрос на выкуп бана"""
    pass


class BuyoutResponse(BaseModel):
    success: bool
    message: str
    new_balance: int
    paid_amount: int


# === Game Schemas ===

class GameSessionCreate(BaseModel):
    game_type: str
    score: int = 0
    bet_amount: int = 0
    win_amount: int = 0
    is_win: bool = False


class GameSessionResponse(BaseModel):
    id: int
    game_type: str
    score: int
    bet_amount: int
    win_amount: int
    is_win: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# === Settings Schemas ===

class WeeklyBanwordCreate(BaseModel):
    word: str
    expires_at: Optional[datetime] = None


class WeeklyBanwordResponse(BaseModel):
    id: int
    word: str
    is_active: bool
    week_number: Optional[int] = None
    times_triggered: int = 0
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class GlobalBanwordCreate(BaseModel):
    word: str


class GlobalBanwordResponse(BaseModel):
    id: int
    word: str
    is_active: bool
    times_triggered: int = 0
    created_at: datetime
    
    class Config:
        from_attributes = True


class GlobalSettingsUpdate(BaseModel):
    key: str
    value: str


# === Admin Schemas ===

class AdminLoginRequest(BaseModel):
    password: str


class AdminStatsResponse(BaseModel):
    total_players: int
    online_players: Optional[int] = 0
    banned_players: int = 0
    total_games: int = 0
    total_balance: int = 0
    total_bans: int = 0
    global_banwords: int = 0
    weekly_banwords: int = 0


class LeaderboardEntry(BaseModel):
    rank: int
    player: PlayerPublic
    
    class Config:
        from_attributes = True
