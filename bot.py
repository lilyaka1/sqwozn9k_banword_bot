# bot.py

from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

from config import BOT_TOKEN, TARGET_USERNAME
from filters import load_banned_words, contains_banned_word

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message and update.message.from_user:
        username = update.message.from_user.username
        text = update.message.text or ""

        if username == TARGET_USERNAME:
            banned_words = load_banned_words()
            if contains_banned_word(text, banned_words):
                try:
                    await update.message.delete()
                    print(f"[✓] Удалено сообщение от @{username}: {text}")
                except Exception as e:
                    print(f"[X] Ошибка удаления: {e}")

if __name__ == "__main__":
    import asyncio

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("🚀 Бот запущен...")
    asyncio.run(app.run_polling())
