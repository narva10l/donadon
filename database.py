"""Conexion con la base de datos MySQL."""

from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # revive conexiones muertas automaticamente
    pool_recycle=280,        # evita el corte de MySQL a las 8 horas
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Pasa a False si al arrancar no se pudo conectar (ver lifespan en main.py)
db_lista = True


class Base(DeclarativeBase):
    """Clase base de la que heredan todas las tablas."""


def get_db():
    """Se usa con `Depends(get_db)` en cada endpoint."""
    if not db_lista:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No se pudo conectar con la base de datos. "
                "Revisa que los contenedores esten corriendo con "
                "'docker compose ps' y que las claves del .env "
                "coincidan con las que se usaron al crear el volumen."
            ),
        )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
