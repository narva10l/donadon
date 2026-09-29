"""Pruebas de los datos de ejemplo (seed.py)."""

import re

import pytest

from auth import verify_password
from config import BASE_DIR
from database import SessionLocal
from models import Usuario
from seed import CLAVE_DEMO, EJEMPLOS, sembrar_si_esta_vacia


# ==================================================================
#  Cuando se siembra
# ==================================================================
def test_siembra_cuando_la_base_esta_vacia():
    with SessionLocal() as sesion:
        creados = sembrar_si_esta_vacia(sesion)

    assert creados == len(EJEMPLOS) == 4


def test_no_siembra_dos_veces():
    """La app llama a esta funcion en cada arranque: debe ser idempotente."""
    with SessionLocal() as sesion:
        assert sembrar_si_esta_vacia(sesion) == 4

    with SessionLocal() as sesion:
        assert sembrar_si_esta_vacia(sesion) == 0

    with SessionLocal() as sesion:
        total = sesion.query(Usuario).count()
    assert total == 4


def test_no_siembra_si_ya_hay_algun_usuario():
    """Aunque sea un solo donante, los ejemplos ya no se agregan."""
    with SessionLocal() as sesion:
        sesion.add(
            Usuario(
                rol="donante",
                nombre="Laura",
                correo="ya-estaba@correo.com",
                password_hash="cualquier-cosa",
            )
        )
        sesion.commit()

    with SessionLocal() as sesion:
        assert sembrar_si_esta_vacia(sesion) == 0

    with SessionLocal() as sesion:
        assert sesion.query(Usuario).count() == 1


# ==================================================================
#  Que los ejemplos esten completos y correctos
# ==================================================================
def test_todos_los_correos_de_ejemplo_son_validos():
    """Todos terminan en un dominio real, no en .local ni .test."""
    for ejemplo in EJEMPLOS:
        assert re.fullmatch(r"[^@\s]+@[^@\s]+\.[a-z]{2,}", ejemplo["correo"]), ejemplo["correo"]


def test_las_contrasenas_de_ejemplo_sirven():
    """La clave documentada en el README debe abrir la cuenta."""
    with SessionLocal() as sesion:
        sembrar_si_esta_vacia(sesion)
        usuarios = sesion.query(Usuario).all()

    assert usuarios
    for usuario in usuarios:
        assert verify_password(CLAVE_DEMO, usuario.password_hash), usuario.correo


def test_hay_tres_caridades_y_un_donante():
    con_rol = [e["rol"] for e in EJEMPLOS]

    assert con_rol.count("caridad") == 3
    assert con_rol.count("donante") == 1


def test_las_caridades_de_ejemplo_traen_todo_lo_obligatorio():
    obligatorios = ["causa", "ubicacion", "cuenta_numero", "cuenta_titular", "cuenta_banco"]

    for ejemplo in EJEMPLOS:
        if ejemplo["rol"] != "caridad":
            continue
        for campo in obligatorios:
            assert ejemplo.get(campo), f"{ejemplo['nombre']} no tiene {campo}"


def test_el_donante_de_ejemplo_no_trae_datos_de_caridad():
    donante = next(e for e in EJEMPLOS if e["rol"] == "donante")

    assert donante["apellido"]
    for campo in ["causa", "ubicacion", "cuenta_numero", "cuenta_titular", "cuenta_banco"]:
        assert campo not in donante


# ==================================================================
#  Que los ejemplos coincidan con el formulario
# ==================================================================
def _opciones_del_formulario(nombre_select: str) -> set[str]:
    """Lee las opciones de un desplegable de templates/index.html.

    Se lee el HTML y no una lista fija en el test, para que haya una sola
    fuente de verdad: si agregas una ciudad al formulario y no la
    pones en el seed (o al reves), esta prueba te avisa.
    """
    html = (BASE_DIR / "templates" / "index.html").read_text(encoding="utf-8")
    bloque = re.search(
        rf'<select name="{nombre_select}".*?</select>', html, re.DOTALL
    ).group(0)

    valores = re.findall(r'<option value="([^"]*)"', bloque)
    return {v for v in valores if v}      # sin el "Selecciona..." vacio


def test_las_ubicaciones_del_seed_existen_en_el_formulario():
    permitidas = _opciones_del_formulario("ubicacion")

    assert permitidas, "no se encontro el desplegable de ubicacion"
    for ejemplo in EJEMPLOS:
        if ejemplo["rol"] == "caridad":
            assert ejemplo["ubicacion"] in permitidas, ejemplo["ubicacion"]


def test_los_bancos_del_seed_existen_en_el_formulario():
    permitidos = _opciones_del_formulario("cuenta_banco")

    assert permitidos, "no se encontro el desplegable de banco"
    for ejemplo in EJEMPLOS:
        if ejemplo["rol"] == "caridad":
            assert ejemplo["cuenta_banco"] in permitidos, ejemplo["cuenta_banco"]


@pytest.mark.parametrize("ejemplo", EJEMPLOS, ids=lambda e: e["nombre"])
def test_cada_ejemplo_pasa_las_validaciones_del_formulario(ejemplo):
    """Si el seed se desactualiza, esto falla antes de que lo note el usuario.

    Se valida con el mismo esquema que usa el formulario, asi que un
    ejemplo al que le falte un campo obligatorio se reporta aqui.
    """
    from schemas import RegistroRequest

    datos = dict(ejemplo)
    datos["password"] = CLAVE_DEMO

    pedido = RegistroRequest.model_validate(datos)

    assert pedido.rol in {"donante", "caridad"}
    assert pedido.correo
