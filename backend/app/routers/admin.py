from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.auth import verify_admin_password
from app.config import settings
from app.models import Player, GlobalBanword
from app.schemas import (
    AdminLoginRequest,
    AdminStatsResponse,
    PlayerResponse,
    WeeklyBanwordCreate,
    WeeklyBanwordResponse,
    LotteryWordCreate,
    LotteryWordResponse,
    GlobalBanwordCreate,
    GlobalBanwordResponse,
)
from app.crud import (
    get_admin_stats,
    get_all_players,
    get_player_by_id,
    get_player_by_telegram_id,
    set_player_balance,
    ban_player,
    get_active_weekly_banwords,
    create_weekly_banword,
    deactivate_weekly_banword,
    get_lottery_word_pool,
    add_lottery_word,
    remove_lottery_word,
    get_random_lottery_word,
    bulk_add_lottery_words,
    get_all_global_banwords,
    create_global_banword,
    delete_global_banword,
)
from app.schemas import BanReason

router = APIRouter(prefix="/admin", tags=["admin"])


def verify_admin_token(x_admin_password: Optional[str] = Header(None)):
    """Проверка админского пароля через заголовок"""
    if x_admin_password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный админский пароль"
        )
    return True


@router.post("/login")
async def admin_login(data: AdminLoginRequest):
    """Логин админа"""
    if not verify_admin_password(data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль"
        )
    return {"success": True, "token": settings.admin_password}


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Получить статистику"""
    stats = await get_admin_stats(db)
    return AdminStatsResponse(**stats)


@router.get("/players", response_model=List[PlayerResponse])
async def get_players(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Получить всех игроков"""
    players = await get_all_players(db, skip, limit)
    return [PlayerResponse.model_validate(p) for p in players]


@router.patch("/players/{player_id}/balance")
async def update_player_balance_admin(
    player_id: int,
    balance: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Установить баланс игрока"""
    player = await set_player_balance(db, player_id, balance)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Игрок не найден"
        )
    return PlayerResponse.model_validate(player)


@router.post("/players/{player_id}/ban")
async def ban_player_admin(
    player_id: int,
    reason: str = "lottery",
    word: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Забанить игрока"""
    if reason not in [BanReason.LOTTERY, BanReason.WEEKLY_WORD, BanReason.PERSONAL_WORD]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверная причина бана"
        )
    
    ban = await ban_player(db, player_id, reason, word)
    if not ban:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Игрок не найден"
        )
    return {"success": True, "ban_id": ban.id, "buyout_price": ban.buyout_price}


# === Weekly Banwords ===

@router.get("/banwords/weekly", response_model=List[WeeklyBanwordResponse])
async def get_weekly_banwords(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Получить банворды недели"""
    banwords = await get_active_weekly_banwords(db)
    return [WeeklyBanwordResponse.model_validate(b) for b in banwords]


@router.post("/banwords/weekly", response_model=WeeklyBanwordResponse)
async def add_weekly_banword(
    data: WeeklyBanwordCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Добавить банворд недели"""
    banword = await create_weekly_banword(db, data.word)
    return WeeklyBanwordResponse.model_validate(banword)


@router.delete("/banwords/weekly/{banword_id}")
async def remove_weekly_banword(
    banword_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Деактивировать банворд недели"""
    success = await deactivate_weekly_banword(db, banword_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Банворд не найден"
        )
    return {"success": True}


# === Lottery Word Pool ===

@router.get("/lottery-words", response_model=List[LotteryWordResponse])
async def get_lottery_words(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Получить все слова из пула лотереи"""
    words = await get_lottery_word_pool(db)
    return [LotteryWordResponse.model_validate(word) for word in words]


@router.post("/lottery-words", response_model=LotteryWordResponse)
async def create_lottery_word(
    word_data: LotteryWordCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Добавить слово в пул лотереи"""
    word = await add_lottery_word(db, word_data.word)
    return LotteryWordResponse.model_validate(word)


@router.post("/lottery-words/bulk")
async def bulk_create_lottery_words(
    words: List[str],
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Массово добавить слова в пул лотереи"""
    added_count = await bulk_add_lottery_words(db, words)
    return {"added": added_count, "total_requested": len(words)}


@router.delete("/lottery-words/{word_id}")
async def delete_lottery_word(
    word_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Удалить слово из пула лотереи"""
    success = await remove_lottery_word(db, word_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Слово не найдено"
        )
    return {"success": True}


@router.get("/lottery-words/random")
async def get_random_word(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Получить случайное слово из пула лотереи"""
    word = await get_random_lottery_word(db)
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пул слов пуст"
        )
    return {"word": word}


# === Global Banwords ===

@router.get("/banwords", response_model=List[GlobalBanwordResponse])
async def get_global_banwords(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Получить глобальные банворды"""
    banwords = await get_all_global_banwords(db)
    return [GlobalBanwordResponse.model_validate(b) for b in banwords]


@router.post("/banwords", response_model=GlobalBanwordResponse)
async def add_global_banword(
    data: GlobalBanwordCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Добавить глобальный банворд"""
    banword = await create_global_banword(db, data.word)
    return GlobalBanwordResponse.model_validate(banword)


@router.delete("/banwords/{banword_id}")
async def remove_global_banword_endpoint(
    banword_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Удалить глобальный банворд"""
    success = await delete_global_banword(db, banword_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Банворд не найден"
        )
    return {"success": True}


# === Ban Management ===

@router.post("/players/{telegram_id}/unban")
async def unban_player_admin(
    telegram_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Разбанить игрока"""
    player = await get_player_by_telegram_id(db, telegram_id)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Игрок не найден"
        )
    
    player.is_banned = False
    player.ban_expires_at = None
    await db.commit()
    return {"success": True}


@router.post("/players/{telegram_id}/reset-balance")
async def reset_player_balance(
    telegram_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Сбросить баланс игрока до начального"""
    player = await get_player_by_telegram_id(db, telegram_id)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Игрок не найден"
        )
    
    player.balance = settings.starting_balance
    player.current_buyout_price = settings.base_buyout_price
    await db.commit()
    return {"success": True, "new_balance": player.balance}


@router.post("/check-expired-bans")
async def check_expired_bans(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_token)
):
    """Проверить и снять истёкшие баны"""
    now = datetime.utcnow()
    
    # Находим всех забаненных с истёкшим сроком
    result = await db.execute(
        select(Player).where(
            Player.is_banned == True,
            Player.ban_expires_at <= now
        )
    )
    expired_players = result.scalars().all()
    
    count = 0
    for player in expired_players:
        player.is_banned = False
        player.ban_expires_at = None
        count += 1
    
    await db.commit()
    
    return {"success": True, "unbanned": count}

