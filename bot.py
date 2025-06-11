import os
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes
from filters import load_banned_words, contains_banned_word

BOT_TOKEN = os.getenv("BOT_TOKEN")
TARGET_USERNAME = os.getenv("TARGET_USERNAME", "ilikewarenek")
BANNED_WORDS_FILE = os.getenv("BANNED_FILE", "banned_words.txt")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message and update.message.from_user:
        if update.message.from_user.username == TARGET_USERNAME:
            text = update.message.text or ""
            banned = load_banned_words(BANNED_WORDS_FILE)
            if contains_banned_word(text, banned):
                await update.message.delete()

if __name__ == "__main__":
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling()
