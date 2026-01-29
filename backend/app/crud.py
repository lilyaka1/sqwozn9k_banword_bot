from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta

from app.models import (
    Player, BanHistory, GameSession, WeeklyBanword, 
    GlobalSettings, GlobalBanword, ChatSettings, LotteryWordPool, BAN_DURATION_HOURS
)
from app.schemas import PlayerCreate, GameSessionCreate, BanReason
from app.config import settings


# === Player CRUD ===

async def get_player_by_telegram_id(db: AsyncSession, telegram_id: int) -> Optional[Player]:
    """Получить игрока по Telegram ID"""
    result = await db.execute(
        select(Player).where(Player.telegram_id == telegram_id)
    )
    return result.scalar_one_or_none()


async def get_player_by_id(db: AsyncSession, player_id: int) -> Optional[Player]:
    """Получить игрока по ID"""
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    return result.scalar_one_or_none()


async def create_player(db: AsyncSession, player_data: PlayerCreate) -> Player:
    """Создать нового игрока"""
    player = Player(
        telegram_id=player_data.telegram_id,
        username=player_data.username,
        first_name=player_data.first_name,
        last_name=player_data.last_name,
        balance=settings.starting_balance,
        current_buyout_price=settings.base_buyout_price,
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)
    return player


async def get_or_create_player(db: AsyncSession, player_data: PlayerCreate) -> tuple[Player, bool]:
    """Получить или создать игрока"""
    player = await get_player_by_telegram_id(db, player_data.telegram_id)
    if player:
        # Обновляем данные профиля
        player.username = player_data.username
        player.first_name = player_data.first_name
        player.last_name = player_data.last_name
        player.last_active_at = datetime.utcnow()
        await db.commit()
        return player, False
    
    player = await create_player(db, player_data)
    return player, True


async def update_player_balance(db: AsyncSession, player_id: int, amount: int) -> Player:
    """Обновить баланс игрока"""
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if player:
        player.balance += amount
        if amount > 0:
            player.total_earned += amount
        else:
            player.total_spent += abs(amount)
        await db.commit()
        await db.refresh(player)
    return player


async def set_player_balance(db: AsyncSession, player_id: int, balance: int) -> Player:
    """Установить баланс игрока"""
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if player:
        player.balance = balance
        await db.commit()
        await db.refresh(player)
    return player


async def get_all_players(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Player]:
    """Получить всех игроков"""
    result = await db.execute(
        select(Player).offset(skip).limit(limit).order_by(Player.balance.desc())
    )
    return result.scalars().all()


async def get_players_count(db: AsyncSession) -> int:
    """Количество игроков"""
    result = await db.execute(select(func.count(Player.id)))
    return result.scalar()


async def get_online_players_count(db: AsyncSession, minutes: int = 15) -> int:
    """Количество онлайн игроков (активных за последние N минут)"""
    threshold = datetime.utcnow() - timedelta(minutes=minutes)
    result = await db.execute(
        select(func.count(Player.id)).where(Player.last_active_at >= threshold)
    )
    return result.scalar()


async def update_player_personal_banwords(db: AsyncSession, player_id: int, banwords: List[str]) -> Player:
    """Обновить личные банворды игрока"""
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if player:
        player.personal_banwords = banwords
        await db.commit()
        await db.refresh(player)
    return player


# === Ban CRUD ===

async def ban_player(
    db: AsyncSession, 
    player_id: int, 
    reason: str, 
    word: Optional[str] = None
) -> BanHistory:
    """Забанить игрока с таймером"""
    player = await get_player_by_id(db, player_id)
    if not player:
        return None
    
    # Определяем множитель
    if reason == BanReason.LOTTERY:
        multiplier = settings.ban_lottery_multiplier
    elif reason == BanReason.WEEKLY_WORD:
        multiplier = settings.ban_weekly_word_multiplier
    elif reason == BanReason.PERSONAL_WORD:
        multiplier = settings.ban_personal_word_multiplier
    else:  # manual или global
        multiplier = 1
    
    # Вычисляем цену выкупа
    buyout_price = player.current_buyout_price * multiplier
    
    # Длительность бана в часах (зависит от множителя)
    duration_hours = BAN_DURATION_HOURS.get(multiplier, 1)
    expires_at = datetime.utcnow() + timedelta(hours=duration_hours)
    
    # Создаём запись о бане
    ban = BanHistory(
        player_id=player_id,
        reason=reason,
        word=word,
        multiplier=multiplier,
        buyout_price=buyout_price,
        duration_hours=duration_hours,
        expires_at=expires_at,
    )
    db.add(ban)
    
    # Обновляем игрока
    player.is_banned = True
    player.ban_expires_at = expires_at
    player.ban_count += 1
    player.last_ban_reason = reason
    player.last_ban_word = word
    player.current_buyout_price = buyout_price  # Цена растёт
    
    await db.commit()
    await db.refresh(ban)
    return ban


async def check_ban_expired(db: AsyncSession, player_id: int) -> bool:
    """Проверить и автоматически снять истёкший бан"""
    player = await get_player_by_id(db, player_id)
    if not player or not player.is_banned:
        return False
    
    # Проверяем истёк ли бан
    if player.ban_expires_at and player.ban_expires_at <= datetime.utcnow():
        player.is_banned = False
        player.ban_expires_at = None
        await db.commit()
        return True  # Бан истёк и снят
    
    return False  # Бан ещё активен


async def get_ban_time_remaining(db: AsyncSession, player_id: int) -> Optional[int]:
    """Получить оставшееся время бана в секундах"""
    player = await get_player_by_id(db, player_id)
    if not player or not player.is_banned or not player.ban_expires_at:
        return None
    
    remaining = player.ban_expires_at - datetime.utcnow()
    return max(0, int(remaining.total_seconds()))


async def buyout_ban(db: AsyncSession, player_id: int) -> tuple[bool, str, int]:
    """Выкупить бан. Возвращает (success, message, paid_amount)"""
    player = await get_player_by_id(db, player_id)
    if not player:
        return False, "Игрок не найден", 0
    
    if not player.is_banned:
        return False, "Вы не забанены", 0
    
    # Находим последний неоплаченный бан
    result = await db.execute(
        select(BanHistory)
        .where(BanHistory.player_id == player_id)
        .where(BanHistory.was_paid == False)
        .order_by(BanHistory.created_at.desc())
        .limit(1)
    )
    ban = result.scalar_one_or_none()
    
    if not ban:
        # Странная ситуация — забанен, но нет записи
        player.is_banned = False
        await db.commit()
        return True, "Бан снят", 0
    
    if player.balance < ban.buyout_price:
        return False, f"Недостаточно средств. Нужно: {ban.buyout_price}, у вас: {player.balance}", 0
    
    # Снимаем деньги
    player.balance -= ban.buyout_price
    player.total_spent += ban.buyout_price
    player.is_banned = False
    
    # Помечаем бан как оплаченный
    ban.was_paid = True
    ban.paid_at = datetime.utcnow()
    
    await db.commit()
    return True, "Бан успешно выкуплен!", ban.buyout_price


async def get_player_ban_history(db: AsyncSession, player_id: int) -> List[BanHistory]:
    """История банов игрока"""
    result = await db.execute(
        select(BanHistory)
        .where(BanHistory.player_id == player_id)
        .order_by(BanHistory.created_at.desc())
    )
    return result.scalars().all()


# === Game Sessions CRUD ===

async def create_game_session(
    db: AsyncSession, 
    player_id: int, 
    session_data: GameSessionCreate
) -> GameSession:
    """Создать сессию игры"""
    session = GameSession(
        player_id=player_id,
        game_type=session_data.game_type,
        score=session_data.score,
        bet_amount=session_data.bet_amount,
        win_amount=session_data.win_amount,
        is_win=session_data.is_win,
    )
    db.add(session)
    
    # Обновляем статистику игрока
    player = await get_player_by_id(db, player_id)
    if player:
        player.games_played += 1
        if session_data.is_win:
            player.games_won += 1
        player.last_active_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(session)
    return session


async def get_total_games_played(db: AsyncSession) -> int:
    """Общее количество сыгранных игр"""
    result = await db.execute(select(func.sum(Player.games_played)))
    return result.scalar() or 0


async def get_total_balance(db: AsyncSession) -> int:
    """Общий баланс всех игроков"""
    result = await db.execute(select(func.sum(Player.balance)))
    return result.scalar() or 0


# === Weekly Banwords CRUD ===

async def get_active_weekly_banwords(db: AsyncSession) -> List[WeeklyBanword]:
    """Получить активные банворды недели"""
    result = await db.execute(
        select(WeeklyBanword).where(WeeklyBanword.is_active == True)
    )
    return result.scalars().all()


async def create_weekly_banword(db: AsyncSession, word: str) -> WeeklyBanword:
    """Создать банворд недели"""
    banword = WeeklyBanword(
        word=word.lower().strip(),
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(banword)
    await db.commit()
    await db.refresh(banword)
    return banword


async def deactivate_weekly_banword(db: AsyncSession, banword_id: int) -> bool:
    """Деактивировать банворд недели"""
    result = await db.execute(
        select(WeeklyBanword).where(WeeklyBanword.id == banword_id)
    )
    banword = result.scalar_one_or_none()
    if banword:
        banword.is_active = False
        await db.commit()
        return True
    return False


# === Lottery Word Pool CRUD ===

async def get_lottery_word_pool(db: AsyncSession) -> List[LotteryWordPool]:
    """Получить все слова из пула лотереи"""
    result = await db.execute(
        select(LotteryWordPool).where(LotteryWordPool.is_active == True)
    )
    return result.scalars().all()


async def add_lottery_word(db: AsyncSession, word: str) -> LotteryWordPool:
    """Добавить слово в пул лотереи"""
    word_obj = LotteryWordPool(word=word.lower().strip())
    db.add(word_obj)
    await db.commit()
    await db.refresh(word_obj)
    return word_obj


async def remove_lottery_word(db: AsyncSession, word_id: int) -> bool:
    """Удалить слово из пула лотереи"""
    result = await db.execute(
        select(LotteryWordPool).where(LotteryWordPool.id == word_id)
    )
    word_obj = result.scalar_one_or_none()
    if word_obj:
        word_obj.is_active = False
        await db.commit()
        return True
    return False


async def get_random_lottery_word(db: AsyncSession) -> Optional[str]:
    """Получить случайное слово из пула лотереи"""
    result = await db.execute(
        select(LotteryWordPool).where(LotteryWordPool.is_active == True)
    )
    words = result.scalars().all()
    
    if not words:
        return None
    
    # Выбираем случайное слово
    import random
    selected_word = random.choice(words)
    
    # Увеличиваем счетчик использования
    selected_word.times_used += 1
    await db.commit()
    
    return selected_word.word


async def bulk_add_lottery_words(db: AsyncSession, words: List[str]) -> int:
    """Массово добавить слова в пул лотереи"""
    added_count = 0
    for word in words:
        word_clean = word.lower().strip()
        if word_clean:
            # Проверяем, не существует ли уже
            result = await db.execute(
                select(LotteryWordPool).where(
                    LotteryWordPool.word == word_clean,
                    LotteryWordPool.is_active == True
                )
            )
            existing = result.scalar_one_or_none()
            if not existing:
                await add_lottery_word(db, word_clean)
                added_count += 1
    
    return added_count


# === Stats ===

async def get_admin_stats(db: AsyncSession) -> dict:
    """Статистика для админки"""
    total_players = await get_players_count(db)
    online_players = await get_online_players_count(db)
    total_games = await get_total_games_played(db)
    total_balance = await get_total_balance(db)
    
    # Количество банов
    total_bans = await db.execute(select(func.count(BanHistory.id)))
    total_bans = total_bans.scalar() or 0
    
    # Активные баны
    active_bans = await db.execute(
        select(func.count(Player.id)).where(Player.is_banned == True)
    )
    active_bans = active_bans.scalar() or 0
    
    # Количество банвордов
    global_banwords_count = await db.execute(
        select(func.count(GlobalBanword.id)).where(GlobalBanword.is_active == True)
    )
    global_banwords_count = global_banwords_count.scalar() or 0
    
    weekly_banwords_count = await db.execute(
        select(func.count(WeeklyBanword.id)).where(WeeklyBanword.is_active == True)
    )
    weekly_banwords_count = weekly_banwords_count.scalar() or 0
    
    return {
        "total_players": total_players,
        "online_players": online_players,
        "banned_players": active_bans,
        "total_games": total_games,
        "total_balance": total_balance,
        "total_bans": total_bans,
        "global_banwords": global_banwords_count,
        "weekly_banwords": weekly_banwords_count,
    }


# === Global Banwords CRUD ===

async def get_all_global_banwords(db: AsyncSession) -> List[GlobalBanword]:
    """Получить все глобальные банворды"""
    result = await db.execute(
        select(GlobalBanword).where(GlobalBanword.is_active == True)
    )
    return result.scalars().all()


async def create_global_banword(db: AsyncSession, word: str) -> GlobalBanword:
    """Создать глобальный банворд"""
    banword = GlobalBanword(word=word.lower().strip())
    db.add(banword)
    await db.commit()
    await db.refresh(banword)
    return banword


async def delete_global_banword(db: AsyncSession, banword_id: int) -> bool:
    """Удалить глобальный банворд"""
    result = await db.execute(
        select(GlobalBanword).where(GlobalBanword.id == banword_id)
    )
    banword = result.scalar_one_or_none()
    if banword:
        banword.is_active = False
        await db.commit()
        return True
    return False


# === Chat Settings CRUD ===

async def get_chat_settings(db: AsyncSession, chat_id: int) -> Optional[ChatSettings]:
    """Получить настройки чата"""
    result = await db.execute(
        select(ChatSettings).where(ChatSettings.chat_id == chat_id)
    )
    return result.scalar_one_or_none()


async def create_or_update_chat_settings(
    db: AsyncSession, 
    chat_id: int, 
    chat_title: str = None,
    **kwargs
) -> ChatSettings:
    """Создать или обновить настройки чата"""
    chat = await get_chat_settings(db, chat_id)
    
    if chat:
        if chat_title:
            chat.chat_title = chat_title
        for key, value in kwargs.items():
            if hasattr(chat, key):
                setattr(chat, key, value)
    else:
        chat = ChatSettings(
            chat_id=chat_id,
            chat_title=chat_title,
            **kwargs
        )
        db.add(chat)
    
    await db.commit()
    await db.refresh(chat)
    return chat


async def get_all_chats_for_notifications(db: AsyncSession) -> List[ChatSettings]:
    """Получить все чаты для уведомлений"""
    result = await db.execute(
        select(ChatSettings).where(ChatSettings.notify_weekly_word == True)
    )
    return result.scalars().all()


# === Weekly Lottery ===

async def start_new_weekly_lottery(db: AsyncSession, word: str) -> WeeklyBanword:
    """Начать новую еженедельную лотерею"""
    import calendar
    from datetime import date
    
    # Деактивируем все старые слова недели
    await db.execute(
        update(WeeklyBanword).where(WeeklyBanword.is_active == True).values(is_active=False)
    )
    
    # Создаём новое слово
    week_number = date.today().isocalendar()[1]
    banword = WeeklyBanword(
        word=word.lower().strip(),
        is_active=True,
        week_number=week_number,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(banword)
    await db.commit()
    await db.refresh(banword)
    return banword


async def get_current_weekly_word(db: AsyncSession) -> Optional[WeeklyBanword]:
    """Получить текущее слово недели"""
    result = await db.execute(
        select(WeeklyBanword)
        .where(WeeklyBanword.is_active == True)
        .order_by(WeeklyBanword.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
