# filters.py - Работа с банвордами через API

import aiohttp
from config import API_URL, ADMIN_PASSWORD


class BanWordChecker:
    """Проверка слов через API бэкенда"""
    
    def __init__(self):
        self.global_words = []
        self.weekly_words = []
        self.personal_words = {}  # telegram_id -> list of words
        self._session = None
    
    async def get_session(self):
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def load_global_words(self):
        """Загрузить глобальные банворды с сервера"""
        try:
            session = await self.get_session()
            async with session.get(
                f"{API_URL}/admin/banwords",
                headers={"X-Admin-Password": ADMIN_PASSWORD}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.global_words = [w["word"].lower() for w in data]
                    print(f"[✓] Загружено {len(self.global_words)} глобальных банвордов")
        except Exception as e:
            print(f"[!] Ошибка загрузки глобальных банвордов: {e}")
    
    async def load_weekly_words(self):
        """Загрузить еженедельные банворды с сервера"""
        try:
            session = await self.get_session()
            async with session.get(
                f"{API_URL}/admin/banwords/weekly",
                headers={"X-Admin-Password": ADMIN_PASSWORD}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.weekly_words = [w["word"].lower() for w in data if w.get("is_active")]
                    print(f"[✓] Загружено {len(self.weekly_words)} еженедельных банвордов")
        except Exception as e:
            print(f"[!] Ошибка загрузки еженедельных банвордов: {e}")
    
    async def load_personal_words(self, telegram_id: int):
        """Загрузить личные банворды пользователя"""
        try:
            session = await self.get_session()
            async with session.get(
                f"{API_URL}/players/{telegram_id}/banwords"
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.personal_words[telegram_id] = [w.lower() for w in data]
                    print(f"[✓] Загружено {len(data)} личных банвордов для {telegram_id}")
        except Exception as e:
            print(f"[!] Ошибка загрузки личных банвордов для {telegram_id}: {e}")
            self.personal_words[telegram_id] = []
    
    async def reload_all(self):
        """Перезагрузить все банворды"""
        await self.load_global_words()
        await self.load_weekly_words()
        print("[✓] Банворды перезагружены")
    
    def check_text(self, text: str, telegram_id: int = None):
        """
        Проверить текст на наличие банвордов
        
        Returns:
            tuple: (found: bool, word: str, reason: str)
            reason: 'global', 'weekly', 'personal' или None
        """
        text_lower = text.lower()
        
        # Проверяем глобальные слова
        for word in self.global_words:
            if word in text_lower:
                return True, word, 'global'
        
        # Проверяем еженедельные слова
        for word in self.weekly_words:
            if word in text_lower:
                return True, word, 'weekly'
        
        # Проверяем личные слова пользователя
        if telegram_id and telegram_id in self.personal_words:
            for word in self.personal_words[telegram_id]:
                if word in text_lower:
                    return True, word, 'personal'
        
        return False, None, None
    
    async def apply_ban(self, telegram_id: int, reason: str, word: str = None):
        """Применить бан через API"""
        try:
            session = await self.get_session()
            async with session.post(
                f"{API_URL}/admin/players/{telegram_id}/ban",
                headers={
                    "X-Admin-Password": ADMIN_PASSWORD,
                    "Content-Type": "application/json"
                },
                json={"reason": reason, "word": word}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data
                else:
                    error = await resp.text()
                    print(f"[!] Ошибка применения бана: {error}")
                    return None
        except Exception as e:
            print(f"[!] Ошибка применения бана: {e}")
            return None


# Глобальный экземпляр
ban_checker = BanWordChecker()


# Legacy функции для совместимости
def load_banned_words(filepath: str = "banned_words.txt") -> list:
    """Загрузка из файла (legacy)"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return [line.strip().lower() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"[!] Файл {filepath} не найден.")
        return []


def contains_banned_word(text: str, banned_words: list) -> bool:
    """Проверка текста (legacy)"""
    lowered = text.lower()
    return any(word in lowered for word in banned_words)
