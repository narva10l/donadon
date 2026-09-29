"""Los formatos de datos que entran y salen de la API (validacion con Pydantic)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

Rol = Literal["donante", "caridad"]


class RegistroRequest(BaseModel):
    """Datos del formulario de registro. Solo `rol`, `nombre`, `correo`
    y `password` son comunes; el resto se pide segun el rol."""

    rol: Rol
    nombre: str = Field(min_length=1, max_length=120)
    correo: EmailStr
    password: str = Field(min_length=6, max_length=128)

    # solo donante
    apellido: str | None = Field(default=None, max_length=120)

    # solo caridad
    causa: str | None = None
    ubicacion: str | None = Field(default=None, max_length=200)
    info_extra: str | None = None
    cuenta_numero: str | None = Field(default=None, max_length=80)
    cuenta_titular: str | None = Field(default=None, max_length=120)
    cuenta_banco: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def validar_segun_rol(self) -> "RegistroRequest":
        """Revisa que falte nada segun el rol elegido y limpia los espacios."""

        def limpio(valor: str | None) -> str | None:
            if valor is None:
                return None
            valor = valor.strip()
            return valor or None

        if self.rol == "donante":
            self.apellido = limpio(self.apellido)
            if not self.apellido:
                raise ValueError("El apellido es obligatorio si eres donante.")
            # un donante no llena datos de caridad
            self.causa = self.ubicacion = self.info_extra = None
            self.cuenta_numero = self.cuenta_titular = self.cuenta_banco = None
        else:
            self.causa = limpio(self.causa)
            self.ubicacion = limpio(self.ubicacion)
            self.info_extra = limpio(self.info_extra)
            self.cuenta_numero = limpio(self.cuenta_numero)
            self.cuenta_titular = limpio(self.cuenta_titular)
            self.cuenta_banco = limpio(self.cuenta_banco)

            obligatorios = {
                "causa": self.causa,
                "ubicacion": self.ubicacion,
                "numero de cuenta": self.cuenta_numero,
                "titular de la cuenta": self.cuenta_titular,
                "banco": self.cuenta_banco,
            }
            faltantes = [etiqueta for etiqueta, valor in obligatorios.items() if not valor]
            if faltantes:
                raise ValueError(
                    "Para registrarte como caridad debes completar: " + ", ".join(faltantes)
                )
            # una caridad no llena apellido
            self.apellido = None

        self.nombre = limpio(self.nombre)
        return self


class LoginRequest(BaseModel):
    correo: EmailStr
    password: str


class TokenOut(BaseModel):
    """Lo que se devuelve al registrarse o iniciar sesion."""

    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str
    correo: EmailStr


class YoOut(BaseModel):
    """Datos del usuario que esta conectado."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    rol: str
    nombre: str
    correo: EmailStr
    creado_en: datetime


class CaridadOut(BaseModel):
    """Lo que se muestra en las tarjetas y en el modal de detalle."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    causa: str
    ubicacion: str
    info_extra: str | None
    cuenta_numero: str
    cuenta_titular: str
    cuenta_banco: str
