"""Contrasenas (bcrypt) y JSON Web Tokens."""

import base64
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import ACCESS_TOKEN_EXPIRE_HOURS, ALGORITHM, SECRET_KEY
from database import get_db
from models import Usuario

# Sirve para leer la cabecera "Authorization: Bearer <token>"
bearer_scheme = HTTPBearer(auto_error=False)


# ------------------------------------------------------------------
# Contrasenas
# ------------------------------------------------------------------
def _preparar(password: str) -> bytes:
    """bcrypt solo acepta 72 bytes. Como una contrasena puede ser mas
    larga, primero le sacamos un hash sha256 y le aplicamos base64.
    Asi el resultado siempre cabe y no se pierde informacion."""
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    """Convierte la contrasena en un hash guardado en la base de datos."""
    return bcrypt.hashpw(_preparar(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Revisa si la contrasena que escribe el usuario es la correcta."""
    try:
        return bcrypt.checkpw(_preparar(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ------------------------------------------------------------------
# JSON Web Token
# ------------------------------------------------------------------
def crear_token(usuario: Usuario) -> str:
    """Arma el JWT con los datos del usuario."""
    expira = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(usuario.id),      # subject: id del usuario
        "rol": usuario.rol,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "exp": expira,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """Se usa en los endpoints privados: valida el token y trae el usuario."""
    if credenciales is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesion para ver esta informacion.",
        )

    try:
        payload = jwt.decode(credenciales.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesion expiro. Vuelve a iniciar sesion.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido.",
        )

    usuario = db.get(Usuario, int(payload["sub"]))
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El usuario de este token ya no existe.",
        )
    return usuario
