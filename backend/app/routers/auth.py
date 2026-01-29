from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta

from app.database import get_db
from app.auth import (
    verify_telegram_auth, 
    create_access_token, 
    get_current_player
)
from app.config import settings
from app.schemas import (
    TelegramAuthData, 
    TokenResponse, 
    PlayerCreate, 
    PlayerResponse
)
from app.crud import get_or_create_player

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram", response_model=TokenResponse)
async def auth_telegram(
    auth_data: TelegramAuthData,
    db: AsyncSession = Depends(get_db)
):
    """
    Авторизация через Telegram WebApp
    """
    # В продакшене проверяем подпись
    # if settings.telegram_bot_token:
    #     if not verify_telegram_auth(auth_data.model_dump(), settings.telegram_bot_token):
    #         raise HTTPException(
    #             status_code=status.HTTP_401_UNAUTHORIZED,
    #             detail="Неверная подпись Telegram"
    #         )
    
    # Создаём или получаем игрока
    player_data = PlayerCreate(
        telegram_id=auth_data.id,
        username=auth_data.username,
        first_name=auth_data.first_name,
        last_name=auth_data.last_name,
    )
    
    player, is_new = await get_or_create_player(db, player_data)
    
    # Создаём токен
    access_token = create_access_token(
        data={"telegram_id": player.telegram_id, "player_id": player.id}
    )
    
    return TokenResponse(
        access_token=access_token,
        player=PlayerResponse.model_validate(player)
    )


@router.post("/telegram/webapp")
async def auth_telegram_webapp(
    init_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Авторизация через Telegram WebApp initData
    Принимает распарсенные данные из window.Telegram.WebApp.initDataUnsafe
    """
    user = init_data.get("user", {})
    
    if not user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не найден user.id в initData"
        )
    
    player_data = PlayerCreate(
        telegram_id=user["id"],
        username=user.get("username"),
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
    )
    
    player, is_new = await get_or_create_player(db, player_data)
    
    access_token = create_access_token(
        data={"telegram_id": player.telegram_id, "player_id": player.id}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "player": PlayerResponse.model_validate(player),
        "is_new": is_new
    }


@router.get("/me", response_model=PlayerResponse)
async def get_me(
    current_player = Depends(get_current_player)
):
    """Получить текущего игрока"""
    return PlayerResponse.model_validate(current_player)
