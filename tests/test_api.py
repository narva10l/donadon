"""Pruebas de la API: iniciar sesion, /api/yo y /api/caridades."""

import pytest

from conftest import (
    cabeceras,
    correo_nuevo,
    datos_caridad,
    datos_donante,
    iniciar_sesion,
    registrar,
    token_de,
)

# Todas las claves que el formulario ofrece, para no repetirlas.
CLAVE = "clave123"


# ==================================================================
#  POST /api/login
# ==================================================================
def test_inicia_sesion_con_credenciales_correctas(cliente):
    datos = datos_donante(nombre="Ana", apellido="Ramos")
    registrar(cliente, datos)

    respuesta = iniciar_sesion(cliente, datos["correo"], CLAVE)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["access_token"]
    assert cuerpo["token_type"] == "bearer"
    assert cuerpo["rol"] == "donante"
    assert cuerpo["nombre"] == "Ana"
    assert cuerpo["correo"] == datos["correo"]


def test_inicia_sesion_con_una_caridad_registrada(cliente):
    datos = datos_caridad()
    registrar(cliente, datos)

    respuesta = iniciar_sesion(cliente, datos["correo"], CLAVE)

    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == "caridad"


def test_contrasena_incorrecta_da_401(cliente):
    datos = datos_donante()
    registrar(cliente, datos)

    respuesta = iniciar_sesion(cliente, datos["correo"], "clave-equivocada")

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "Correo o contrasena incorrectos."


def test_correo_inexistente_da_401(cliente):
    respuesta = iniciar_sesion(cliente, correo_nuevo(), CLAVE)

    assert respuesta.status_code == 401


def test_no_revela_que_correos_existen(cliente):
    """Con correo inexistente y con contrasena mala, el mismo mensaje.

    Si no, alguien podria usarla para averiguar quien esta registrado.
    """
    datos = datos_donante()
    registrar(cliente, datos)

    correo_malo = iniciar_sesion(cliente, correo_nuevo(), CLAVE)
    clave_mala = iniciar_sesion(cliente, datos["correo"], "otra-cosa")

    assert correo_malo.json() == clave_mala.json()
    assert correo_malo.json()["detail"] == "Correo o contrasena incorrectos."


def test_el_correo_se_puede_escribir_en_mayusculas(cliente):
    datos = datos_donante(correo="ana@correo.com")
    registrar(cliente, datos)

    respuesta = iniciar_sesion(cliente, "ANA@Correo.com", CLAVE)

    assert respuesta.status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {"correo": "no-es-correo", "password": CLAVE},
        {"correo": "ana@correo.com"},
        {"password": CLAVE},
        {},
    ],
)
def test_rechaza_datos_de_entrada_incompletos(cliente, payload):
    respuesta = cliente.post("/api/login", json=payload)

    assert respuesta.status_code == 422


# ==================================================================
#  GET /api/yo
# ==================================================================
def test_yo_devuelve_los_datos_del_usuario(cliente):
    token = token_de(cliente, datos_donante(nombre="Laura", apellido="Gomez"))

    respuesta = cliente.get("/api/yo", headers=cabeceras(token))

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Laura"
    assert cuerpo["rol"] == "donante"
    assert "creado_en" in cuerpo


def test_yo_no_devuelve_la_contrasena(cliente):
    token = token_de(cliente, datos_donante())

    respuesta = cliente.get("/api/yo", headers=cabeceras(token))

    cuerpo = respuesta.json()
    assert "password" not in cuerpo
    assert "password_hash" not in cuerpo


def test_yo_sin_token_da_401(cliente):
    respuesta = cliente.get("/api/yo")

    assert respuesta.status_code == 401


def test_yo_con_token_inventado_da_401(cliente):
    respuesta = cliente.get("/api/yo", headers=cabeceras("cualquier-cosa"))

    assert respuesta.status_code == 401


# ==================================================================
#  GET /api/caridades
# ==================================================================
def test_caridades_empieza_vacia(cliente):
    token = token_de(cliente, datos_donante())

    respuesta = cliente.get("/api/caridades", headers=cabeceras(token))

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_caridades_sin_token_da_401(cliente):
    respuesta = cliente.get("/api/caridades")

    assert respuesta.status_code == 401


def test_caridades_devuelve_las_tres_campos_que_necesita(cliente):
    """Nombre (titulo), causa (subtitulo) y ubicacion."""
    token = token_de(cliente, datos_donante())
    registrar(cliente, datos_caridad(nombre="Manos que Resucitan"))

    respuesta = cliente.get("/api/caridades", headers=cabeceras(token))

    caridad = respuesta.json()[0]
    assert caridad["nombre"] == "Manos que Resucitan"
    assert caridad["causa"] == "Ninos con cancer"
    assert caridad["ubicacion"] == "Torreon, Coahuila"


def test_caridades_devuelve_todos_los_datos_del_modal(cliente):
    """Incluye la informacion extra y los tres datos bancarios."""
    token = token_de(cliente, datos_donante())
    registrar(cliente, datos_caridad(info_extra="Ayudamos a 100 ninos."))

    caridad = cliente.get("/api/caridades", headers=cabeceras(token)).json()[0]

    assert caridad["info_extra"] == "Ayudamos a 100 ninos."
    assert caridad["cuenta_numero"] == "123-456-7890"
    assert caridad["cuenta_titular"] == "Fundacion de Prueba"
    assert caridad["cuenta_banco"] == "BBVA"


def test_caridades_solo_muestra_caridades(cliente):
    """Los donantes no deben salir en el listado."""
    token = token_de(cliente, datos_donante(nombre="Laura"))
    registrar(cliente, datos_caridad(nombre="Fundacion Uno"))
    registrar(cliente, datos_caridad(nombre="Fundacion Dos"))

    respuesta = cliente.get("/api/caridades", headers=cabeceras(token))

    nombres = [c["nombre"] for c in respuesta.json()]
    assert nombres == ["Fundacion Dos", "Fundacion Uno"]   # la mas reciente primero
    assert "Laura" not in nombres


def test_los_dos_roles_ven_la_misma_lista(cliente):
    """Requisito: الحيوية y donante ven exactamente lo mismo."""
    token_donante = token_de(cliente, datos_donante())
    token_caridad = token_de(cliente, datos_caridad(nombre="Fundacion Visible"))
    token_otra_caridad = token_de(cliente, datos_caridad(nombre="Segunda Fundacion"))

    lista_donante = cliente.get("/api/caridades", headers=cabeceras(token_donante)).json()
    lista_caridad = cliente.get("/api/caridades", headers=cabeceras(token_caridad)).json()
    lista_otra = cliente.get("/api/caridades", headers=cabeceras(token_otra_caridad)).json()

    assert lista_donante == lista_caridad == lista_otra
    assert len(lista_donante) == 2


def test_una_caridad_registrada_aparece_al_instante(cliente):
    """Sin aprobacion: apenas se registra, ya sale en el listado."""
    token = token_de(cliente, datos_donante())
    assert cliente.get("/api/caridades", headers=cabeceras(token)).json() == []

    registrar(cliente, datos_caridad(nombre="Aparecen Ya"))

    lista = cliente.get("/api/caridades", headers=cabeceras(token)).json()
    assert [c["nombre"] for c in lista] == ["Aparecen Ya"]


def test_la_lista_trae_las_caridades_del_seed(cliente):
    """Arranque en frío: se siembran los ejemplos y ya salen en el listado."""
    from database import SessionLocal
    from seed import CLAVE_DEMO, EJEMPLOS, sembrar_si_esta_vacia

    # primero los ejemplos, como hace la app al arrancar
    with SessionLocal() as sesion:
        assert sembrar_si_esta_vacia(sesion) == len(EJEMPLOS)

    token = iniciar_sesion(cliente, EJEMPLOS[0]["correo"], CLAVE_DEMO).json()["access_token"]

    lista = cliente.get("/api/caridades", headers=cabeceras(token)).json()

    esperados = {e["nombre"] for e in EJEMPLOS if e["rol"] == "caridad"}
    assert {c["nombre"] for c in lista} == esperados


# ==================================================================
#  Rutas que no existen
# ==================================================================
def test_ruta_inexistente_da_404(cliente):
    assert cliente.get("/api/no-existe").status_code == 404
