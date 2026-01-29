# SQWOZ Games Platform

🎮 Telegram бот с мини-играми и системой банвордов.

## ✅ Что реализовано

- [x] Админская панель со статусом разбанами банами
- [x] BlockBlast (адаптивные фигуры)
- [x] Rovers Racing (ставки на гонки)
- [x] Slots
- [x] Rover Smash
- [x] База данных игроков (PostgreSQL)
- [x] Система выкупа банов с множителями
- [x] Личные банворды игроков
- [x] Telegram WebApp интеграция

## 📦 Структура проекта

```
sqwozn9k_banword_bot/
├── bot.py                 # Telegram бот
├── config.py              # Конфигурация
├── filters.py             # Логика банвордов
├── requirements.txt       # Python зависимости бота
├── .env.example           # Пример переменных окружения
│
├── backend/               # FastAPI бэкенд
│   ├── requirements.txt   # Python зависимости
│   └── app/
│       ├── main.py        # Точка входа
│       ├── config.py      # Настройки
│       ├── database.py    # PostgreSQL (async)
│       ├── models.py      # ORM модели
│       ├── schemas.py     # Pydantic схемы
│       ├── auth.py        # JWT + Telegram auth
│       ├── crud.py        # CRUD операции
│       └── routers/       # API эндпоинты
│
├── frontend/              # React приложение
│   ├── package.json
│   └── src/
│       ├── api/           # API клиент + хуки
│       ├── pages/         # Страницы игр + админка
│       └── components/    # Компоненты
│
└── webapp/                # Legacy HTML версия
```

## 🚀 Быстрый старт

### 1. Бэкенд (FastAPI + PostgreSQL)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Создать .env файл (скопировать из .env.example)
# Заполнить DATABASE_URL и другие переменные

uvicorn app.main:app --reload --port 8000
```

### 2. Фронтенд (React + Vite)

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

### 3. Телеграм бот

```bash
# В корне проекта
pip install -r requirements.txt
cp .env.example .env
# Заполнить BOT_TOKEN и другие переменные
python bot.py
```

## 🎮 Игры

| Игра | Описание |
|------|----------|
| 🏇 Скачки | Ставки на роверов |
| 🎰 Слоты | Классический слот-машина |
| 🧱 Block Blast | Тетрис-пазл с адаптивными фигурами |
| 🎯 Rover Smash | Тапай роверов на скорость |

## 🔒 Система банов

### Множители выкупа
- **Глобальные слова**: x1 (базовая цена)
- **Лотерея**: x2 
- **Еженедельные слова**: x4
- **Личные слова**: x4

### Команды бота
```
/start       - Главное меню
/profile     - Профиль игрока
/games       - Открыть игры
/banwords    - Мои личные банворды
/addword     - Добавить личный банворд
/delword     - Удалить личный банворд
/lottery     - Крутить лотерею
/buyout      - Выкупить бан

# Админские команды
/admin       - Статистика
/reload      - Перезагрузить банворды
/ban ID      - Забанить игрока
/unban ID    - Разбанить игрока
```

## 🌐 Деплой (бесплатный стек)

### Frontend → Vercel
1. Push в GitHub
2. Подключить репо в Vercel
3. Указать `VITE_API_URL` в Environment Variables

### Backend → Render
1. Создать Web Service
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Database → Neon
1. Создать проект на neon.tech
2. Скопировать connection string
3. Заменить `postgres://` на `postgresql+asyncpg://`

## 📝 API Endpoints

### Auth
- `POST /auth/telegram` - Авторизация через Telegram WebApp

### Players
- `GET /players/{id}` - Профиль игрока
- `PUT /players/{id}/balance` - Обновить баланс
- `POST /players/{id}/games` - Сохранить результат
- `GET /players/{id}/ban` - Получить активный бан
- `POST /players/{id}/ban/buyout` - Выкупить бан
- `GET /players/{id}/banwords` - Личные банворды

### Admin (X-Admin-Password header)
- `GET /admin/stats` - Статистика
- `GET /admin/players` - Список игроков
- `POST /admin/players/{id}/ban` - Забанить
- `GET /admin/banwords` - Глобальные банворды
- `GET /admin/banwords/weekly` - Еженедельные

## 🔧 Переменные окружения

### Backend (.env)
```env
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
BOT_TOKEN=telegram_bot_token
JWT_SECRET=random_secret
ADMIN_PASSWORD=sqwoz2024
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
```

### Bot (.env)
```env
BOT_TOKEN=telegram_bot_token
API_URL=http://localhost:8000
ADMIN_PASSWORD=sqwoz2024
WEBAPP_URL=https://your-app.vercel.app
ADMIN_IDS=123456789,987654321
```

## Технологии

- **React 19** — UI
- **FastAPI** — Backend API
- **PostgreSQL** — База данных (Neon)
- **python-telegram-bot** — Telegram бот
- **Vite 7** — Сборщик
- **CSS Modules** — Стили

## 📄 Лицензия

MIT

