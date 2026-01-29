from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import ssl
from app.config import settings

# Убираем sslmode из URL если есть (asyncpg не понимает его)
database_url = settings.database_url
if "?" in database_url:
    database_url = database_url.split("?")[0]

# Создаём SSL контекст для Neon
ssl_context = ssl.create_default_context()

engine = create_async_engine(
    database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args={"ssl": ssl_context}
)

async_session_maker = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
