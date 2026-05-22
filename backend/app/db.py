from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Create standard SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Ensure dead connections are recycled
    pool_size=10,
    max_overflow=20
)

# Thread-safe Session local factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

def get_db():
    """FastAPI dependency for DB session context management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
