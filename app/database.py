from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings
import os

# Railway.app database configuration
def get_database_url():
    """Get database URL with Railway.app compatibility"""
    database_url = settings.database_url
    
    # If DATABASE_URL is not set, use SQLite for Railway.app
    if not database_url or database_url == "sqlite:///./app.db":
        # Railway.app compatible SQLite path
        database_url = "sqlite:///./app.db"
    
    return database_url

# Create database engine with Railway.app compatibility
engine = create_engine(
    get_database_url(),
    connect_args={"check_same_thread": False} if "sqlite" in get_database_url() else {},
    pool_pre_ping=True,  # Railway.app connection pooling
    echo=settings.debug  # Debug SQL queries in development
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def create_tables():
    """Create all database tables with Railway.app compatibility"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        # Railway.app fallback: try to create tables individually
        try:
            from .models import User, Room, Message, Icebreaker, UserLike, UserDislike
            User.__table__.create(engine, checkfirst=True)
            Room.__table__.create(engine, checkfirst=True)
            Message.__table__.create(engine, checkfirst=True)
            Icebreaker.__table__.create(engine, checkfirst=True)
            UserLike.__table__.create(engine, checkfirst=True)
            UserDislike.__table__.create(engine, checkfirst=True)
            print("✅ Database tables created individually")
        except Exception as e2:
            print(f"❌ Failed to create tables individually: {e2}")
            raise e2
