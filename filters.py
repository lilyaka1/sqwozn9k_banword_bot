# filters.py

def load_banned_words(filepath: str = "banned_words.txt") -> list:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return [line.strip().lower() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"[!] Файл {filepath} не найден. Вернулся пустой список.")
        return []

def contains_banned_word(text: str, banned_words: list) -> bool:
    lowered = te xt.lower()
    return any(word in lowered for word in banned_words)
