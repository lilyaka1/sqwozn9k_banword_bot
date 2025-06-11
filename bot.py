import os
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, CommandHandler, filters, ContextTypes
from filters import load_banned_words, contains_banned_word

# Получаем переменные окружения
BOT_TOKEN = os.getenv("BOT_TOKEN")
TARGET_USERNAME = os.getenv("TARGET_USERNAME", "ilikewarenek")
BANNED_WORDS_FILE = os.getenv("BANNED_FILE", "banned_words.txt")

# Загружаем банлист один раз при старте
banned_words = load_banned_words(BANNED_WORDS_FILE)

# Команда для перезагрузки бан-листа без перезапуска бота
async def reload_banlist(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global banned_words
    banned_words = load_banned_words(BANNED_WORDS_FILE)
    await update.message.reply_text(
        f"🔄 Банк слов перезагружен, всего {len(banned_words)} записей."
    )

# Обработчик входящих сообщений
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message and update.message.from_user:
        if update.message.from_user.username == TARGET_USERNAME:
            text = update.message.text or ""
            if contains_banned_word(text, banned_words):
                try:
                    await update.message.delete()
                    print(f"[x] Сообщение от @{TARGET_USERNAME} удалено.")
                except Exception as e:
                    print(f"[!] Ошибка при удалении: {e}")

# Запуск бота
if __name__ == "__main__":
    print("[>] Бот запускается...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    # Добавляем команды
    app.add_handler(CommandHandler("reload", reload_banlist))
    # Добавляем фильтр сообщений
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()
