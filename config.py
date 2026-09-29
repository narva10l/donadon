"""Configuracion general: lee el archivo .env y expone los ajustes."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Carga el .env (si existe) para poder leer SECRET_KEY, DB_*, etc.
load_dotenv(BASE_DIR / ".env")


# --- Base de datos -------------------------------------------------------
DB_USER = os.getenv("DB_USER", "dona_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "pon_aqui_tu_clave")
DB_NAME = os.getenv("DB_NAME", "dona_donador")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)


# --- JSON Web Token ------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "clave-por-defecto-cambiala-en-el-env")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
