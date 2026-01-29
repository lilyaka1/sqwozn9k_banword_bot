# config.py - Конфигурация бота

import os
from dotenv import load_dotenv

load_dotenv()

# Telegram Bot
BOT_TOKEN = os.getenv("BOT_TOKEN", "8190845573:AAFp73ddi3qRBZhOAOfMkJlxpDKehVErG_o")

# Backend API
API_URL = os.getenv("API_URL", "http://localhost:8000")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "sqwoz2024")

# WebApp URLs
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-app.vercel.app")

# Чат для уведомлений (можно изменить через /setchat)
TARGET_CHAT_ID = int(os.getenv("TARGET_CHAT_ID", "0"))

# Настройки бана
BASE_BUYOUT_PRICE = 100  # Базовая цена выкупа
LOTTERY_MULTIPLIER = 2   # Множитель для лотереи
WEEKLY_WORD_MULTIPLIER = 4  # Множитель для еженедельного слова
PERSONAL_WORD_MULTIPLIER = 4  # Множитель для личного слова

# Длительность бана в часах по множителю
BAN_DURATION_HOURS = {
    1: 1,    # x1 = 1 час (глобальные слова)
    2: 2,    # x2 = 2 часа (лотерея)
    4: 8,    # x4 = 8 часов (еженедельное/личное слово)
}

# Список админов (telegram_id)
ADMIN_IDS = [
    int(id.strip()) 
    for id in os.getenv("ADMIN_IDS", "").split(",") 
    if id.strip()
]
