from sqlalchemy import Column, Integer, BigInteger, String, Text, Float, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Player(Base):
    """Игрок"""
    __tablename__ = "players"
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(100), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    
    # Экономика
    balance = Column(Integer, default=1000)
    total_earned = Column(Integer, default=0)
    total_spent = Column(Integer, default=0)
    
    # Баны
    ban_count = Column(Integer, default=0)
    current_buyout_price = Column(Integer, default=100)
    is_banned = Column(Boolean, default=False)
    ban_expires_at = Column(DateTime(timezone=True), nullable=True)  # Когда истекает бан
    last_ban_reason = Column(String(50), nullable=True)  # lottery, weekly_word, personal_word
    last_ban_word = Column(String(100), nullable=True)
    
    # Личные банворды (JSON array)
    personal_banwords = Column(JSON, default=list)
    
    # Статистика игр
    games_played = Column(Integer, default=0)
    games_won = Column(Integer, default=0)
    
    # Даты
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    ban_history = relationship("BanHistory", back_populates="player")
    game_sessions = relationship("GameSession", back_populates="player")


class BanHistory(Base):
    """История банов"""
    __tablename__ = "ban_history"
    
    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    
    reason = Column(String(50), nullable=False)  # lottery, weekly_word, personal_word, manual
    word = Column(String(100), nullable=True)  # слово, за которое забанили
    multiplier = Column(Integer, default=2)
    buyout_price = Column(Integer, nullable=False)
    was_paid = Column(Boolean, default=False)
    
    # Время бана
    duration_hours = Column(Integer, nullable=False, default=1)  # Длительность в часах
    expires_at = Column(DateTime(timezone=True), nullable=False)  # Когда истекает
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    player = relationship("Player", back_populates="ban_history")


class GameSession(Base):
    """Сессия игры"""
    __tablename__ = "game_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    
    game_type = Column(String(50), nullable=False)  # horse_racing, slots, block_blast, rover_smash
    score = Column(Integer, default=0)
    bet_amount = Column(Integer, default=0)
    win_amount = Column(Integer, default=0)
    is_win = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    player = relationship("Player", back_populates="game_sessions")


class GlobalSettings(Base):
    """Глобальные настройки"""
    __tablename__ = "global_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WeeklyBanword(Base):
    """Банворд недели"""
    __tablename__ = "weekly_banwords"
    
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    week_number = Column(Integer, nullable=True)  # Номер недели
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Статистика
    times_triggered = Column(Integer, default=0)  # Сколько раз сработало


class GlobalBanword(Base):
    """Глобальный банворд (постоянный)"""
    __tablename__ = "global_banwords"
    
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(100), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    times_triggered = Column(Integer, default=0)


class ChatSettings(Base):
    """Настройки чата для уведомлений"""
    __tablename__ = "chat_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(BigInteger, unique=True, nullable=False)  # ID конфы
    chat_title = Column(String(255), nullable=True)
    
    # Настройки уведомлений
    notify_on_ban = Column(Boolean, default=True)  # Уведомлять о банах
    notify_on_unban = Column(Boolean, default=True)  # Уведомлять о разбанах
    notify_weekly_word = Column(Boolean, default=True)  # Уведомлять о слове недели
    
    # Игры
    games_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Длительность бана в часах по множителю
BAN_DURATION_HOURS = {
    1: 1,    # x1 = 1 час
    2: 2,    # x2 = 2 часа (лотерея)
    4: 8,    # x4 = 8 часов (еженедельное/личное слово)
}
