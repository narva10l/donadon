"""Pruebas de las contrasenas (bcrypt) y de los JSON Web Tokens."""

import time

import jwt
import pytest

from auth import crear_token, hash_password, verify_password
from config import ALGORITHM, SECRET_KEY
from conftest import cabeceras
from models import Usuario


# ==================================================================
#  Contrasenas
# ==================================================================
def test_el_hash_no_es_la_contrasena():
    """La contrasena nunca se guarda tal cual."""
    hash_guardado = hash_password("clave123")

    assert hash_guardado != "clave123"
    assert "clave123" not in hash_guardado


def test_cada_hash_es_distinto():
    """bcrypt usa una sal aleatoria, asi que dos hashes difieren."""
    assert hash_password("clave123") != hash_password("clave123")


def test_verifica_contrasena_correcta():
    hash_guardado = hash_password("clave123")

    assert verify_password("clave123", hash_guardado) is True


def test_rechaza_contrasena_incorrecta():
    hash_guardado = hash_password("clave123")

    assert verify_password("otra-clave", hash_guardado) is False


def test_contrasena_larga_no_falla():
    """bcrypt acepta maximo 72 bytes, asi que se resume con sha256 antes."""
    larga = "x" * 300

    assert verify_password(larga, hash_password(larga)) is True


def test_contrasena_con_acentos():
    hash_guardado = hash_password("ContraseñaSegura1")

    assert verify_password("ContraseñaSegura1", hash_guardado) is True
    assert verify_password("ContrasenaSegura1", hash_guardado) is False


def test_hash_con_asteriscos_da_error_no_explota():
    """Un hash corrupto en la base no debe reventar la app."""
    assert verify_password("clave123", "no-es-un-hash") is False
    assert verify_password("clave123", "") is False


# ==================================================================
#  JSON Web Tokens
# ==================================================================
class UsuarioFalso:
    """Sirve para armar un token sin tocar la base de datos."""

    id = 7
    rol = "caridad"
    nombre = "Fundacion Falsa"
    correo = "falsa@correo.com"


def test_el_token_lleva_los_datos_del_usuario():
    token = crear_token(UsuarioFalso())
    contenido = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    assert contenido["sub"] == "7"
    assert contenido["rol"] == "caridad"
    assert contenido["nombre"] == "Fundacion Falsa"
    assert contenido["correo"] == "falsa@correo.com"


def test_el_token_tiene_fecha_de_expiracion():
    contenido = jwt.decode(crear_token(UsuarioFalso()), SECRET_KEY, algorithms=[ALGORITHM])

    assert "exp" in contenido
    assert contenido["exp"] > time.time()


def test_rechaza_token_con_firma_invalida():
    """Si alguien cambia el contenido, la firma ya no cuadra."""
    token = crear_token(UsuarioFalso())

    # la clave tiene que medir 32 bytes o PyJWT avisa que es corta
    with pytest.raises(jwt.InvalidTokenError):
        jwt.decode(token, "otra-clave-suficientemente-larga-1234", algorithms=[ALGORITHM])


def test_rechaza_token_vencido():
    token = jwt.encode(
        {
            "sub": "7",
            "rol": "caridad",
            "exp": int(time.time()) - 10,   # ya paso
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ==================================================================
#  Proteccion de las rutas
# ==================================================================
def test_sin_token_responde_401(cliente):
    respuesta = cliente.get("/api/caridades")

    assert respuesta.status_code == 401
    assert "sesion" in respuesta.json()["detail"].lower()


def test_token_falso_responde_401(cliente):
    respuesta = cliente.get("/api/caridades", headers=cabeceras("token-inventado"))

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "Token invalido."


def test_token_de_usuario_borrado_responde_401(cliente):
    """Un token bien firmado pero de alguien que ya no existe."""
    token = crear_token(UsuarioFalso())   # id 7, nunca se registro

    respuesta = cliente.get("/api/caridades", headers=cabeceras(token))

    assert respuesta.status_code == 401
    assert "ya no existe" in respuesta.json()["detail"]


def test_token_con_formato_ilegal_responde_401(cliente):
    respuesta = cliente.get("/api/caridades", headers=cabeceras("no.es.un.jwt"))

    assert respuesta.status_code == 401
