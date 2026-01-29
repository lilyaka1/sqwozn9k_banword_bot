#!/usr/bin/env python3
"""
SQWOZ Banword Bot - Телеграм бот с системой банвордов и мини-играми

Функционал:
- Отслеживание сообщений в чатах
- Проверка на глобальные, еженедельные и личные банворды
- Система банов с выкупом (множители x2/x4) и таймером
- Уведомления в конфу о банах и еженедельных словах
- Мини-игры через WebApp для быстрого разбана
- Еженедельная лотерея с новым словом
"""

import os
import asyncio
import random
import aiohttp
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder,
    MessageHandler,
    CommandHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes,
    JobQueue
)

from config import (
    BOT_TOKEN,
    API_URL,
    ADMIN_PASSWORD,
    WEBAPP_URL,
    ADMIN_IDS,
    BASE_BUYOUT_PRICE
)
from filters import ban_checker


# ID конфы для уведомлений (можно настроить через /setchat)
TARGET_CHAT_ID = int(os.getenv("TARGET_CHAT_ID", "0"))

# Длительность бана по множителю (в часах)
BAN_DURATION = {
    1: 1,    # x1 = 1 час
    2: 2,    # x2 = 2 часа (лотерея)
    4: 8,    # x4 = 8 часов (еженедельное/личное слово)
}


async def main():
    """Основная функция запуска бота"""
    print("[🚀] Запуск SQWOZ Banword Bot...")

    # Проверяем токен
    if not BOT_TOKEN:
        print("[❌] BOT_TOKEN не найден!")
        return

    print(f"[✅] API_URL: {API_URL}")
    print(f"[✅] WEBAPP_URL: {WEBAPP_URL}")

    # Создаем приложение
    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # Загружаем фильтры
    await ban_checker.load_global_words()
    await ban_checker.load_weekly_words()

    # Регистрируем хендлеры
    register_handlers(application)

    print("[🎯] Бот запущен! Ожидание сообщений...")

    # Запуск с graceful shutdown
    try:
        await application.run_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True
        )
    except KeyboardInterrupt:
        print("[🛑] Бот остановлен пользователем")
    except Exception as e:
        print(f"[❌] Ошибка запуска бота: {e}")
    finally:
        await application.shutdown()


def register_handlers(application):
    """Регистрация всех хендлеров бота"""
    # Команды пользователя
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("profile", cmd_profile))
    application.add_handler(CommandHandler("banwords", cmd_banwords))
    application.add_handler(CommandHandler("addword", cmd_addword))
    application.add_handler(CommandHandler("delword", cmd_delword))
    application.add_handler(CommandHandler("buyout", cmd_buyout))
    application.add_handler(CommandHandler("lottery", cmd_lottery))
    application.add_handler(CommandHandler("games", cmd_games))
    
    # Команды админа
    application.add_handler(CommandHandler("reload", cmd_reload))
    application.add_handler(CommandHandler("admin", cmd_admin))
    application.add_handler(CommandHandler("ban", cmd_ban))
    application.add_handler(CommandHandler("unban", cmd_unban))
    application.add_handler(CommandHandler("setchat", cmd_setchat))
    application.add_handler(CommandHandler("weeklyword", cmd_weeklyword))
    application.add_handler(CommandHandler("startlottery", cmd_startlottery))
    application.add_handler(CommandHandler("filllottery", cmd_filllottery))
    
    # Callback кнопки
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    # Обработчик сообщений
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Startup/shutdown
    application.post_init = on_startup
    application.post_shutdown = on_shutdown


if __name__ == "__main__":
    asyncio.run(main())

# Еженедельные слова для лотереи (теперь берутся из БД)
# WEEKLY_WORD_POOL = [
#     "дно", "зашквар", "кринж", "душнила", "токсик", 
#     "флекс", "рофл", "имба", "нуб", "изи",
#     "хайп", "вайб", "чилл", "краш", "рандом"
# ]


# ==================== API HELPERS ====================

async def api_request(method: str, endpoint: str, json_data: dict = None, admin: bool = False):
    """Отправить запрос к API"""
    headers = {"Content-Type": "application/json"}
    if admin:
        headers["X-Admin-Password"] = ADMIN_PASSWORD
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{API_URL}{endpoint}"
            async with session.request(method, url, json=json_data, headers=headers) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error = await resp.text()
                    print(f"[API Error] {resp.status}: {error}")
                    return None
    except Exception as e:
        print(f"[API Error] Connection failed: {e}")
        return None


async def get_or_create_player(user):
    """Получить или создать игрока"""
    result = await api_request("GET", f"/players/{user.id}")
    if not result:
        # Игрок не существует, создаём через авторизацию
        # В реальности это делается через WebApp
        pass
    return result


async def get_player_ban(telegram_id: int):
    """Получить активный бан игрока"""
    return await api_request("GET", f"/players/{telegram_id}/ban")


async def buyout_ban(telegram_id: int):
    """Выкупить бан"""
    return await api_request("POST", f"/players/{telegram_id}/ban/buyout")


async def get_random_lottery_word():
    """Получить случайное слово из пула лотереи"""
    return await api_request("GET", "/admin/lottery-words/random", admin=True)


# ==================== NOTIFICATIONS ====================

async def notify_chat_ban(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user, word: str, reason: str, duration_hours: int, buyout_price: int):
    """Отправить уведомление о бане в конфу"""
    if not chat_id:
        return
    
    reason_text = {
        "global_word": "🌍 Глобальный банворд",
        "weekly_word": "📅 Слово недели (x4)",
        "personal_word": "👤 Личный банворд (x4)",
        "lottery": "🎰 Лотерея (x2)",
        "manual": "🔨 Ручной бан",
    }.get(reason, reason)
    
    username = f"@{user.username}" if user.username else user.first_name
    
    await context.bot.send_message(
        chat_id,
        f"🚫 **БАН!**\n\n"
        f"👤 {username}\n"
        f"📝 Слово: `{word}`\n"
        f"📂 {reason_text}\n"
        f"⏱ Длительность: {duration_hours} ч.\n"
        f"💵 Выкуп: {buyout_price} 💰\n\n"
        f"🎮 [Разбанься быстрее в играх!]({WEBAPP_URL})",
        parse_mode="Markdown",
        disable_web_page_preview=True
    )


async def notify_chat_unban(context: ContextTypes.DEFAULT_TYPE, chat_id: int, user, method: str):
    """Отправить уведомление о разбане в конфу"""
    if not chat_id:
        return
    
    username = f"@{user.username}" if user.username else user.first_name
    method_text = "💰 выкупился" if method == "buyout" else "⏱ отсидел срок"
    
    await context.bot.send_message(
        chat_id,
        f"✅ **РАЗБАН!**\n\n"
        f"👤 {username} {method_text}!",
        parse_mode="Markdown"
    )


async def notify_weekly_word(context: ContextTypes.DEFAULT_TYPE, chat_id: int, word: str, week_number: int):
    """Отправить уведомление о новом слове недели"""
    if not chat_id:
        return
    
    await context.bot.send_message(
        chat_id,
        f"🎰 **НОВАЯ НЕДЕЛЯ ГОЛОДНЫХ ИГР!**\n\n"
        f"📅 Неделя #{week_number}\n\n"
        f"🔥 Слово недели:\n"
        f"```{word}```\n\n"
        f"⚠️ Кто напишет это слово — получит БАН!\n"
        f"💵 Множитель выкупа: **x4**\n"
        f"⏱ Длительность: **8 часов**\n\n"
        f"🎮 [Готовься к разбану заранее!]({WEBAPP_URL})",
        parse_mode="Markdown",
        disable_web_page_preview=True
    )


# ==================== SCHEDULED JOBS ====================

async def job_weekly_lottery(context: ContextTypes.DEFAULT_TYPE):
    """Еженедельная лотерея - выбор нового слова недели"""
    print("[JOB] Запуск еженедельной лотереи...")
    
    # Получаем случайное слово из базы данных
    word_data = await get_random_lottery_word()
    if not word_data or not word_data.get("word"):
        print("[JOB] Ошибка: пул слов лотереи пуст!")
        return
    
    new_word = word_data["word"]
    week_number = datetime.now().isocalendar()[1]
    
    # Сохраняем в API
    result = await api_request(
        "POST", 
        "/admin/banwords/weekly",
        {"word": new_word, "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat()},
        admin=True
    )
    
    if result:
        print(f"[JOB] Новое слово недели: {new_word}")
        
        # Обновляем локальный кэш
        await ban_checker.load_weekly_words()
        
        # Уведомляем чаты
        if TARGET_CHAT_ID:
            await notify_weekly_word(context, TARGET_CHAT_ID, new_word, week_number)
    else:
        print("[JOB] Ошибка создания слова недели")


async def job_check_expired_bans(context: ContextTypes.DEFAULT_TYPE):
    """Проверка истёкших банов"""
    # Это будет вызываться каждые 5 минут
    result = await api_request("POST", "/admin/check-expired-bans", admin=True)
    if result and result.get("unbanned", 0) > 0:
        print(f"[JOB] Автоматически разбанено: {result['unbanned']} игроков")


# ==================== КОМАНДЫ ====================

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    user = update.effective_user
    
    keyboard = [
        [InlineKeyboardButton("🎮 Играть", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton("👤 Профиль", callback_data="profile")],
        [InlineKeyboardButton("🎰 Лотерея", callback_data="lottery")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"👋 Привет, {user.first_name}!\n\n"
        "🎮 Добро пожаловать в SQWOZ Games!\n\n"
        "Выбери действие:",
        reply_markup=reply_markup
    )


async def cmd_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /profile - показать профиль"""
    user = update.effective_user
    player = await get_or_create_player(user)
    
    if not player:
        await update.message.reply_text("❌ Ошибка загрузки профиля. Попробуй позже.")
        return
    
    ban_info = ""
    if player.get("is_banned"):
        ban = await get_player_ban(user.id)
        if ban:
            ban_info = f"\n\n🚫 **ЗАБАНЕН**\nПричина: {ban.get('reason', 'Неизвестно')}\nЦена выкупа: {ban.get('buyout_price', 0)} 💰"
    
    await update.message.reply_text(
        f"👤 **Профиль**\n\n"
        f"🆔 ID: `{player.get('telegram_id')}`\n"
        f"📛 Имя: {player.get('first_name', 'Неизвестно')}\n"
        f"💰 Баланс: {player.get('balance', 0)}\n"
        f"🔨 Банов: {player.get('ban_count', 0)}\n"
        f"💵 Цена выкупа: {player.get('current_buyout_price', BASE_BUYOUT_PRICE)}"
        f"{ban_info}",
        parse_mode="Markdown"
    )


async def cmd_banwords(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /banwords - показать личные банворды"""
    user = update.effective_user
    
    result = await api_request("GET", f"/players/{user.id}/banwords")
    
    if not result:
        await update.message.reply_text(
            "📝 У тебя пока нет личных банвордов.\n\n"
            "Добавить: `/addword слово`"
        , parse_mode="Markdown")
        return
    
    words_list = "\n".join([f"• {w}" for w in result])
    await update.message.reply_text(
        f"📝 **Твои личные банворды:**\n\n{words_list}\n\n"
        "Добавить: `/addword слово`\n"
        "Удалить: `/delword слово`",
        parse_mode="Markdown"
    )


async def cmd_addword(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /addword - добавить личный банворд"""
    user = update.effective_user
    
    if not context.args:
        await update.message.reply_text("❌ Укажи слово: `/addword слово`", parse_mode="Markdown")
        return
    
    word = " ".join(context.args).lower()
    
    result = await api_request("POST", f"/players/{user.id}/banwords", {"word": word})
    
    if result:
        await update.message.reply_text(f"✅ Слово `{word}` добавлено в твой личный банлист!", parse_mode="Markdown")
        # Обновляем кэш
        await ban_checker.load_personal_words(user.id)
    else:
        await update.message.reply_text("❌ Ошибка добавления слова.")


async def cmd_delword(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /delword - удалить личный банворд"""
    user = update.effective_user
    
    if not context.args:
        await update.message.reply_text("❌ Укажи слово: `/delword слово`", parse_mode="Markdown")
        return
    
    word = " ".join(context.args).lower()
    
    result = await api_request("DELETE", f"/players/{user.id}/banwords/{word}")
    
    if result:
        await update.message.reply_text(f"✅ Слово `{word}` удалено из твоего банлиста!", parse_mode="Markdown")
        await ban_checker.load_personal_words(user.id)
    else:
        await update.message.reply_text("❌ Слово не найдено или ошибка удаления.")


async def cmd_buyout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /buyout - выкупить бан"""
    user = update.effective_user
    
    result = await buyout_ban(user.id)
    
    if result:
        await update.message.reply_text(
            f"✅ Бан успешно выкуплен!\n"
            f"💰 Списано: {result.get('paid', 0)}\n"
            f"💵 Остаток: {result.get('balance', 0)}"
        )
    else:
        await update.message.reply_text("❌ Нет активного бана или недостаточно средств.")


async def cmd_lottery(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /lottery - лотерея"""
    user = update.effective_user
    
    keyboard = [
        [InlineKeyboardButton("🎰 Крутить лотерею", callback_data="spin_lottery")],
        [InlineKeyboardButton("❌ Отмена", callback_data="cancel")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎰 **ЛОТЕРЕЯ**\n\n"
        "Крути барабан и получи случайный бан!\n"
        "⚠️ Цена выкупа будет x2 от текущей.\n\n"
        "Готов рискнуть?",
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )


async def cmd_reload(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /reload - перезагрузить банлист (только админы)"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    await ban_checker.reload_all()
    await update.message.reply_text(
        f"🔄 Банлисты перезагружены!\n"
        f"• Глобальных: {len(ban_checker.global_words)}\n"
        f"• Еженедельных: {len(ban_checker.weekly_words)}"
    )


async def cmd_games(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /games - открыть игры"""
    keyboard = [
        [InlineKeyboardButton("🎮 Открыть игры", web_app=WebAppInfo(url=WEBAPP_URL))],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎮 **SQWOZ Games**\n\n"
        "• 🏇 Скачки\n"
        "• 🎰 Слоты\n"
        "• 🧱 Блок Бласт\n"
        "• 🎯 Rover Smash\n\n"
        "Нажми кнопку чтобы открыть:",
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )


# ==================== ADMIN COMMANDS ====================

async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /admin - админ панель"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    stats = await api_request("GET", "/admin/stats", admin=True)
    
    if not stats:
        await update.message.reply_text("❌ Ошибка загрузки статистики.")
        return
    
    await update.message.reply_text(
        f"📊 **Админ-панель**\n\n"
        f"👥 Игроков: {stats.get('total_players', 0)}\n"
        f"🚫 Забанено: {stats.get('banned_players', 0)}\n"
        f"🎮 Игр сыграно: {stats.get('total_games', 0)}\n"
        f"📝 Глобальных банвордов: {stats.get('global_banwords', 0)}\n"
        f"📅 Еженедельных банвордов: {stats.get('weekly_banwords', 0)}\n\n"
        f"🌐 Веб-панель: {WEBAPP_URL}/admin",
        parse_mode="Markdown"
    )


async def cmd_ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /ban - забанить пользователя"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    if not context.args:
        await update.message.reply_text("❌ Укажи ID: `/ban 123456789 причина`", parse_mode="Markdown")
        return
    
    try:
        target_id = int(context.args[0])
        reason = " ".join(context.args[1:]) if len(context.args) > 1 else "manual"
    except ValueError:
        await update.message.reply_text("❌ Неверный ID.")
        return
    
    result = await api_request("POST", f"/admin/players/{target_id}/ban", {"reason": reason}, admin=True)
    
    if result:
        await update.message.reply_text(f"✅ Пользователь {target_id} забанен.")
    else:
        await update.message.reply_text("❌ Ошибка бана.")


async def cmd_unban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /unban - разбанить пользователя"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    if not context.args:
        await update.message.reply_text("❌ Укажи ID: `/unban 123456789`", parse_mode="Markdown")
        return
    
    try:
        target_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("❌ Неверный ID.")
        return
    
    result = await api_request("POST", f"/admin/players/{target_id}/unban", admin=True)
    
    if result:
        await update.message.reply_text(f"✅ Пользователь {target_id} разбанен.")
    else:
        await update.message.reply_text("❌ Ошибка разбана.")


async def cmd_filllottery(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /filllottery - заполнить пул слов лотереи (только админы)"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    # Старый пул слов
    old_pool = [
        "дно", "зашквар", "кринж", "душнила", "токсик", 
        "флекс", "рофл", "имба", "нуб", "изи",
        "хайп", "вайб", "чилл", "краш", "рандом"
    ]
    
    result = await api_request("POST", "/admin/lottery-words/bulk", old_pool, admin=True)
    
    if result:
        added = result.get("added", 0)
        total = result.get("total_requested", 0)
        await update.message.reply_text(
            f"✅ Пул слов лотереи заполнен!\n"
            f"Добавлено: {added}/{total} слов"
        )
    else:
        await update.message.reply_text("❌ Ошибка заполнения пула слов.")


# ==================== CALLBACK HANDLERS ====================

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик callback кнопок"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user = query.from_user
    
    if data == "profile":
        player = await get_or_create_player(user)
        if player:
            await query.edit_message_text(
                f"👤 **Профиль**\n\n"
                f"💰 Баланс: {player.get('balance', 0)}\n"
                f"🔨 Банов: {player.get('ban_count', 0)}\n"
                f"💵 Цена выкупа: {player.get('current_buyout_price', BASE_BUYOUT_PRICE)}",
                parse_mode="Markdown"
            )
    
    elif data == "lottery":
        await query.edit_message_text(
            "🎰 **ЛОТЕРЕЯ**\n\n"
            "Крути барабан и получи случайный бан!\n"
            "⚠️ Цена выкупа будет x2 от текущей.\n\n"
            "Готов рискнуть?",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🎰 Крутить!", callback_data="spin_lottery")],
                [InlineKeyboardButton("❌ Нет, спасибо", callback_data="cancel")],
            ]),
            parse_mode="Markdown"
        )
    
    elif data == "spin_lottery":
        # Применяем бан через лотерею
        result = await api_request(
            "POST", 
            f"/admin/players/{user.id}/ban",
            {"reason": "lottery"},
            admin=True
        )
        
        if result:
            await query.edit_message_text(
                "🎰 **ЛОТЕРЕЯ**\n\n"
                "🔴 Ты получил БАН!\n\n"
                f"💵 Цена выкупа: {result.get('buyout_price', 0)}\n\n"
                "Используй /buyout чтобы выкупиться.",
                parse_mode="Markdown"
            )
        else:
            await query.edit_message_text("❌ Ошибка лотереи. Попробуй позже.")
    
    elif data == "cancel":
        await query.edit_message_text("👋 Окей, в другой раз!")


# ==================== MESSAGE HANDLER ====================

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик входящих сообщений - проверка на банворды"""
    if not update.message or not update.message.from_user:
        return
    
    user = update.message.from_user
    text = update.message.text or ""
    
    if not text:
        return
    
    # Загружаем личные банворды если ещё не загружены
    if user.id not in ban_checker.personal_words:
        await ban_checker.load_personal_words(user.id)
    
    # Проверяем текст
    found, word, reason = ban_checker.check_text(text, user.id)
    
    if found:
        try:
            # Удаляем сообщение
            await update.message.delete()
            print(f"[x] Сообщение от {user.id} удалено (слово: {word}, причина: {reason})")
            
            # Применяем бан
            ban_reason = {
                'global': 'global_word',
                'weekly': 'weekly_word',
                'personal': 'personal_word'
            }.get(reason, 'manual')
            
            # Определяем множитель и длительность
            multiplier = 1
            if reason == 'weekly':
                multiplier = 4
            elif reason == 'personal':
                multiplier = 4
            elif reason == 'lottery':
                multiplier = 2
            
            duration_hours = BAN_DURATION.get(multiplier, 1)
            
            result = await ban_checker.apply_ban(user.id, ban_reason, word)
            
            if result:
                buyout_price = result.get('buyout_price', 0)
                
                # Уведомляем пользователя в личку
                try:
                    await context.bot.send_message(
                        user.id,
                        f"🚫 **Ты получил БАН!**\n\n"
                        f"📝 Слово: `{word}`\n"
                        f"📂 Тип: {reason}\n"
                        f"⏱ Длительность: {duration_hours} ч.\n"
                        f"💵 Цена выкупа: {buyout_price} (x{multiplier})\n\n"
                        f"🎮 [Разбанься в играх!]({WEBAPP_URL})\n"
                        f"Или используй /buyout",
                        parse_mode="Markdown",
                        disable_web_page_preview=True
                    )
                except Exception as e:
                    print(f"[!] Не удалось отправить уведомление в личку: {e}")
                
                # Уведомляем конфу
                chat_id = update.message.chat_id if update.message.chat.type != "private" else TARGET_CHAT_ID
                if chat_id and chat_id != user.id:
                    await notify_chat_ban(context, chat_id, user, word, ban_reason, duration_hours, buyout_price)
        
        except Exception as e:
            print(f"[!] Ошибка при обработке сообщения: {e}")


# ==================== ADMIN CHAT COMMANDS ====================

async def cmd_setchat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /setchat - установить текущий чат для уведомлений"""
    user = update.effective_user
    chat = update.effective_chat
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    if chat.type == "private":
        await update.message.reply_text("❌ Эту команду нужно использовать в группе/чате.")
        return
    
    global TARGET_CHAT_ID
    TARGET_CHAT_ID = chat.id
    
    await update.message.reply_text(
        f"✅ Этот чат установлен для уведомлений!\n\n"
        f"🆔 Chat ID: `{chat.id}`\n"
        f"📛 Название: {chat.title}",
        parse_mode="Markdown"
    )


async def cmd_weeklyword(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /weeklyword - установить слово недели вручную"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    if not context.args:
        # Показать текущее слово
        weekly = ban_checker.weekly_words
        if weekly:
            await update.message.reply_text(
                f"📅 **Текущие слова недели:**\n\n" + 
                "\n".join([f"• `{w}`" for w in weekly]),
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text("📅 Нет активных слов недели.")
        return
    
    word = " ".join(context.args).lower()
    
    # Запускаем новую лотерею с этим словом
    result = await api_request(
        "POST", 
        "/admin/banwords/weekly",
        {"word": word, "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat()},
        admin=True
    )
    
    if result:
        await ban_checker.load_weekly_words()
        week_number = datetime.now().isocalendar()[1]
        
        await update.message.reply_text(
            f"✅ Слово недели установлено: `{word}`",
            parse_mode="Markdown"
        )
        
        # Уведомляем конфу
        if TARGET_CHAT_ID:
            await notify_weekly_word(context, TARGET_CHAT_ID, word, week_number)
    else:
        await update.message.reply_text("❌ Ошибка установки слова недели.")


async def cmd_startlottery(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /startlottery - запустить еженедельную лотерею вручную"""
    user = update.effective_user
    
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("❌ Только для админов.")
        return
    
    await update.message.reply_text("🎰 Запускаю еженедельную лотерею...")
    await job_weekly_lottery(context)
    await update.message.reply_text("✅ Лотерея запущена!")


# ==================== STARTUP ====================

async def on_startup(app):
    """Действия при запуске бота"""
    print("[>] Загрузка банвордов...")
    await ban_checker.reload_all()
    
    # Настраиваем scheduled jobs
    job_queue = app.job_queue
    
    # Еженедельная лотерея - каждый понедельник в 10:00
    job_queue.run_daily(
        job_weekly_lottery,
        time=datetime.strptime("10:00", "%H:%M").time(),
        days=(0,),  # Понедельник
        name="weekly_lottery"
    )
    
    # Проверка истёкших банов - каждые 5 минут
    job_queue.run_repeating(
        job_check_expired_bans,
        interval=300,  # 5 минут
        first=60,  # Первый запуск через минуту
        name="check_expired_bans"
    )
    
    print("[✓] Scheduled jobs настроены!")
    print("[✓] Бот готов к работе!")


async def on_shutdown(app):
    """Действия при остановке бота"""
    await ban_checker.close()
    print("[x] Бот остановлен.")


# ==================== MAIN ====================

if __name__ == "__main__":
    asyncio.run(main())
