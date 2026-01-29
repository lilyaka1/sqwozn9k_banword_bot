from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from app.database import get_db
from app.auth import get_current_player
from app.models import Player
from app.schemas import (
    PlayerResponse, 
    PlayerUpdate,
    BanHistoryResponse,
    BuyoutRequest,
    BuyoutResponse,
    GameSessionCreate,
    GameSessionResponse,
    LeaderboardEntry,
)
from app.crud import (
    update_player_balance,
    update_player_personal_banwords,
    get_player_ban_history,
    buyout_ban,
    create_game_session,
)

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Получить лидерборд игроков по балансу"""
    result = await db.execute(
        select(Player)
        .where(Player.is_banned == False)
        .order_by(desc(Player.balance))
        .limit(limit)
    )
    players = result.scalars().all()
    
    return [
        LeaderboardEntry(
            rank=idx + 1,
            telegram_id=p.telegram_id,
            username=p.username,
            first_name=p.first_name,
            balance=p.balance,
            total_wins=p.total_wins or 0
        )
        for idx, p in enumerate(players)
    ]


@router.get("/me", response_model=PlayerResponse)
async def get_current_player_info(
    current_player: Player = Depends(get_current_player)
):
    """Получить информацию о текущем игроке"""
    return PlayerResponse.model_validate(current_player)


@router.patch("/me", response_model=PlayerResponse)
async def update_current_player(
    update_data: PlayerUpdate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Обновить данные текущего игрока"""
    if update_data.personal_banwords is not None:
        await update_player_personal_banwords(
            db, 
            current_player.id, 
            update_data.personal_banwords
        )
    
    # Обновляем объект
    await db.refresh(current_player)
    return PlayerResponse.model_validate(current_player)


@router.get("/me/bans", response_model=List[BanHistoryResponse])
async def get_my_ban_history(
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Получить историю банов"""
    bans = await get_player_ban_history(db, current_player.id)
    return [BanHistoryResponse.model_validate(ban) for ban in bans]


@router.post("/me/buyout", response_model=BuyoutResponse)
async def buyout_current_ban(
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Выкупить текущий бан"""
    success, message, paid_amount = await buyout_ban(db, current_player.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    await db.refresh(current_player)
    
    return BuyoutResponse(
        success=True,
        message=message,
        new_balance=current_player.balance,
        paid_amount=paid_amount
    )


@router.post("/me/games", response_model=GameSessionResponse)
async def save_game_session(
    session_data: GameSessionCreate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Сохранить результат игры"""
    # Обновляем баланс если есть выигрыш/проигрыш
    balance_change = session_data.win_amount - session_data.bet_amount
    if balance_change != 0:
        await update_player_balance(db, current_player.id, balance_change)
    
    session = await create_game_session(db, current_player.id, session_data)
    return GameSessionResponse.model_validate(session)


@router.post("/me/banwords", response_model=PlayerResponse)
async def add_personal_banword(
    word: str,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Добавить личный банворд"""
    banwords = current_player.personal_banwords or []
    word_lower = word.lower().strip()
    
    if word_lower not in banwords:
        banwords.append(word_lower)
        await update_player_personal_banwords(db, current_player.id, banwords)
    
    await db.refresh(current_player)
    return PlayerResponse.model_validate(current_player)


@router.delete("/me/banwords/{word}", response_model=PlayerResponse)
async def remove_personal_banword(
    word: str,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Удалить личный банворд"""
    banwords = current_player.personal_banwords or []
    word_lower = word.lower().strip()
    
    if word_lower in banwords:
        banwords.remove(word_lower)
        await update_player_personal_banwords(db, current_player.id, banwords)
    
    await db.refresh(current_player)
    return PlayerResponse.model_validate(current_player)
