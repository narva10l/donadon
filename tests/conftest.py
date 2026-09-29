"""Configuracion de las pruebas.

Las pruebas NUNCA tocan la base de datos real: usan una base aparte,
'dona_donador_test', que se crea sola y se destruye al terminar.
"""

import os

# ------------------------------------------------------------------
#  Esto tiene que ir PRIMERO, antes de importar nada del proyecto.
#  config.py lee las variables de entorno en el momento en que se
#  importa y arma la URL de MySQL ahi mismo. Si importamos la app
#  antes de cambiar DB_NAME, las pruebas le talkarian a la base real.
# ------------------------------------------------------------------
TEST_DB_NAME = "dona_donador_test"
os.environ["DB_NAME"] = TEST_DB_NAME
# ------------------------------------------------------------------

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import main
from database import Base, engine
from models import Usuario


# ==================================================================
#  Base de datos
# ==================================================================
@pytest.fixture(scope="session", autouse=True)
def preparar_base():
    """Crea la base de pruebas y las tablas. Se borra todo al final."""
    # El usuario de la app (dona_user) NO puede crear bases de datos:
    # la imagen de MySQL solo le da permisos sobre dona_donador.
    # Por eso esta parte se conecta como root.
    url_root = (
        f"mysql+pymysql://root:{os.environ['MYSQL_ROOT_PASSWORD']}"
        f"@{os.environ['DB_HOST']}:{os.environ['DB_PORT']}/?charset=utf8mb4"
    )
    motor_root = create_engine(url_root, isolation_level="AUTOCOMMIT")
    with motor_root.connect() as conexion:
        conexion.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS {TEST_DB_NAME} "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        )
        # Y tampoco tiene permisos sobre ella: se los damos aqui.
        # Es idempotente, asi que da igual cuantas veces se corran las pruebas.
        conexion.execute(
            text(
                f"GRANT ALL PRIVILEGES ON {TEST_DB_NAME}.* "
                f"TO '{os.environ['DB_USER']}'@'%'"
            )
        )
        conexion.execute(text("FLUSH PRIVILEGES"))
    motor_root.dispose()

    Base.metadata.create_all(bind=engine)

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def base_limpia(preparar_base):
    """Deja la tabla de usuarios vacia antes de cada prueba."""
    Sesion = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    with Sesion() as sesion:
        sesion.query(Usuario).delete()
        sesion.commit()
    yield


# ==================================================================
#  Cliente HTTP
# ==================================================================
@pytest.fixture
def cliente(base_limpia):
    """Cliente para llamar a la API.

    Depende de base_limpia a proposito: asi la limpieza ocurre ANTES
    de que exista el cliente, sin importar si este dispara el arranque
    de la app.
    """
    return TestClient(main.app)


# ==================================================================
#  Datos de ejemplo para las pruebas
# ==================================================================
CORREO_UNICO = "prueba-{codigo}@correo.com"


def correo_nuevo() -> str:
    """Cada registro necesita un correo distinto."""
    return CORREO_UNICO.format(codigo=uuid.uuid4().hex[:10])


def datos_caridad(**cambios) -> dict:
    base = {
        "rol": "caridad",
        "nombre": "Fundacion de Prueba",
        "correo": correo_nuevo(),
        "password": "clave123",
        "causa": "Ninos con cancer",
        "ubicacion": "Torreon, Coahuila",
        "info_extra": "Ayudamos a 100 ninos.",
        "cuenta_numero": "123-456-7890",
        "cuenta_titular": "Fundacion de Prueba",
        "cuenta_banco": "BBVA",
    }
    base.update(cambios)
    return base


def datos_donante(**cambios) -> dict:
    base = {
        "rol": "donante",
        "nombre": "Ana",
        "apellido": "Ramos",
        "correo": correo_nuevo(),
        "password": "clave123",
    }
    base.update(cambios)
    return base


def registrar(cliente, datos: dict) -> dict:
    """Registra un usuario y devuelve la respuesta."""
    return cliente.post("/api/registro", json=datos)


def iniciar_sesion(cliente, correo: str, password: str = "clave123") -> dict:
    return cliente.post("/api/login", json={"correo": correo, "password": password})


def token_de(cliente, datos: dict) -> str:
    """Registra un usuario y devuelve su token."""
    respuesta = registrar(cliente, datos)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["access_token"]


def cabeceras(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
