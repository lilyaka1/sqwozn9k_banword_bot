from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hashlib
import hmac

from app.config import settings
from app.database import get_db
from app.models import Player

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_telegram_auth(auth_data: dict, bot_token: str) -> bool:
    """Проверка подписи данных от Telegram"""
    check_hash = auth_data.pop('hash', None)
    if not check_hash:
        return False
    
    # Сортируем и формируем строку для проверки
    data_check_string = '\n'.join(
        f'{k}={v}' for k, v in sorted(auth_data.items()) if v is not None
    )
    
    # Создаём секретный ключ
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    
    # Вычисляем hash
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(calculated_hash, check_hash)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создание JWT токена"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Декодирование JWT токена"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


async def get_current_player(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Player:
    """Получение текущего игрока по токену"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise credentials_exception
    
    telegram_id: int = payload.get("telegram_id")
    if telegram_id is None:
        raise credentials_exception
    
    result = await db.execute(
        select(Player).where(Player.telegram_id == telegram_id)
    )
    player = result.scalar_one_or_none()
    
    if player is None:
        raise credentials_exception
    
    return player


async def get_current_active_player(
    current_player: Player = Depends(get_current_player)
) -> Player:
    """Получение активного (не забаненного) игрока"""
    # Обновляем last_active_at в другом месте
    return current_player


def verify_admin_password(password: str) -> bool:
    """Проверка пароля админа"""
    return password == settings.admin_password
