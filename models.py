"""Definicion de las tablas."""

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Usuario(Base):
    """Una sola tabla para los dos roles.

    Los campos de `apellido` los usan los donantes.
    Los campos de causa / ubicacion / info_extra / cuenta_* los usan las caridades.
    Los que no apliquen se guardan en NULL.
    """

    __tablename__ = "usuarios"

    # --- comunes ---
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)   # donante | caridad
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    correo: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # --- solo donante ---
    apellido: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # --- solo caridad ---
    causa: Mapped[str | None] = mapped_column(Text, nullable=True)
    ubicacion: Mapped[str | None] = mapped_column(String(200), nullable=True)
    info_extra: Mapped[str | None] = mapped_column(Text, nullable=True)
    cuenta_numero: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cuenta_titular: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cuenta_banco: Mapped[str | None] = mapped_column(String(120), nullable=True)

    def __repr__(self) -> str:
        return f"<Usuario {self.id} {self.rol} {self.correo}>"
