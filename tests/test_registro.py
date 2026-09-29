"""Pruebas del registro: que se pueda y que se rechace lo que no debe."""

import pytest

from conftest import cabeceras, datos_caridad, datos_donante, registrar
from database import SessionLocal
from models import Usuario


# ==================================================================
#  Registros que SI deben funcionar
# ==================================================================
def test_registra_un_donante(cliente):
    datos = datos_donante()

    respuesta = registrar(cliente, datos)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["rol"] == "donante"
    assert cuerpo["nombre"] == "Ana"
    assert cuerpo["correo"] == datos["correo"]
    assert cuerpo["access_token"]


def test_registra_una_caridad(cliente):
    respuesta = registrar(cliente, datos_caridad())

    assert respuesta.status_code == 201
    assert respuesta.json()["rol"] == "caridad"


def test_el_donante_registrado_aparece_en_la_base(cliente):
    datos = datos_donante(nombre="Carlos", apellido="Lopez")

    registrar(cliente, datos)

    with SessionLocal() as sesion:
        usuario = sesion.query(Usuario).filter_by(correo=datos["correo"]).one()
    assert usuario.nombre == "Carlos"
    assert usuario.apellido == "Lopez"
    assert usuario.rol == "donante"


@pytest.mark.parametrize(
    "campo",
    ["nombre", "correo", "password"],
)
def test_rechaza_si_falta_un_campo_comun(cliente, campo):
    datos = datos_donante()
    datos.pop(campo)

    respuesta = registrar(cliente, datos)

    assert respuesta.status_code == 422


# ==================================================================
#  Campos que dependen del rol
# ==================================================================
def test_donante_sin_apellido_se_rechaza(cliente):
    """El apellido es lo unico extra que pide el donante."""
    respuesta = registrar(cliente, datos_donante(apellido=None))

    assert respuesta.status_code == 422
    assert "apellido" in respuesta.text


def test_donante_con_apellido_de_solo_espacios_se_rechaza(cliente):
    """'   ' no cuenta como apellido."""
    respuesta = registrar(cliente, datos_donante(apellido="   "))

    assert respuesta.status_code == 422
    assert "apellido" in respuesta.text


@pytest.mark.parametrize(
    "campo",
    ["causa", "ubicacion", "cuenta_numero", "cuenta_titular", "cuenta_banco"],
)
def test_caridad_incompleta_se_rechaza(cliente, campo):
    datos = datos_caridad()
    datos[campo] = None

    respuesta = registrar(cliente, datos)

    assert respuesta.status_code == 422
    assert campo in respuesta.text


def test_el_error_dice_todo_lo_que_falta(cliente):
    """Si faltan varios campos, el mensaje los lista todos."""
    respuesta = registrar(
        cliente,
        datos_caridad(causa=None, ubicacion=None, cuenta_banco=None),
    )

    assert respuesta.status_code == 422
    for campo in ["causa", "ubicacion", "banco"]:
        assert campo in respuesta.text


def test_informacion_extra_es_opcional(cliente):
    """Solo 'info extra' se puede dejar vacio en una caridad."""
    respuesta = registrar(cliente, datos_caridad(info_extra=None))

    assert respuesta.status_code == 201


def test_los_campos_del_otro_rol_se_ignoran(cliente):
    """Un donante no puede guardar datos de caridad y viceversa."""
    donante = datos_donante(
        causa="esto no debe guardarse",
        cuenta_banco="BBVA",
        cuenta_numero="999",
    )
    registrar(cliente, donante)

    caridad = datos_caridad(nombre="Otra Fundacion", apellido="No debe guardarse")
    registrar(cliente, caridad)

    with SessionLocal() as sesion:
        guardado_donante = sesion.query(Usuario).filter_by(correo=donante["correo"]).one()
        guardado_caridad = sesion.query(Usuario).filter_by(correo=caridad["correo"]).one()

    assert guardado_donante.causa is None
    assert guardado_donante.cuenta_banco is None
    assert guardado_donante.cuenta_numero is None

    assert guardado_caridad.apellido is None
    # ...pero si conserva sus propios datos
    assert guardado_caridad.causa == "Ninos con cancer"
    assert guardado_caridad.cuenta_banco == "BBVA"


# ==================================================================
#  Validaciones de los formatos
# ==================================================================
@pytest.mark.parametrize(
    "correo",
    ["no-es-correo", "falta@dominio", "@sin-usuario.com", "con espacio@x.com", ""],
)
def test_rechaza_correos_invalidos(cliente, correo):
    respuesta = registrar(cliente, datos_donante(correo=correo))

    assert respuesta.status_code == 422


@pytest.mark.parametrize("clave", ["12345", "a", ""])
def test_rechaza_contrasenas_cortas(cliente, clave):
    """El minimo son 6 caracteres."""
    respuesta = registrar(cliente, datos_donante(password=clave))

    assert respuesta.status_code == 422


@pytest.mark.parametrize("rol", ["administrador", "", "DONANTE", "voluntario"])
def test_rechaza_roles_desconocidos(cliente, rol):
    respuesta = registrar(cliente, datos_donante(rol=rol))

    assert respuesta.status_code == 422


def test_los_espacios_sobrantes_se_limpian(cliente):
    respuesta = registrar(cliente, datos_donante(nombre="  Ana  ", apellido=" Ramos "))

    assert respuesta.status_code == 201
    assert respuesta.json()["nombre"] == "Ana"


def test_el_correo_se_guarda_en_minusculas(cliente):
    respuesta = registrar(cliente, datos_donante(correo="ANA.MARIA@Correo.COM"))

    assert respuesta.status_code == 201
    assert respuesta.json()["correo"] == "ana.maria@correo.com"


# ==================================================================
#  Correos repetidos
# ==================================================================
def test_no_deja_registrar_el_mismo_correo_dos_veces(cliente):
    datos = datos_donante()

    primera = registrar(cliente, datos)
    segunda = registrar(cliente, datos)

    assert primera.status_code == 201
    assert segunda.status_code == 409
    assert "Ya existe" in segunda.json()["detail"]


def test_el_correo_repetido_se_detecta_tambien_en_mayusculas(cliente):
    """Como se guardan en minusculas, 'ANA@x.com' cuenta como el mismo."""
    registrar(cliente, datos_donante(correo="ana@correo.com"))

    respuesta = registrar(cliente, datos_donante(correo="ANA@Correo.com"))

    assert respuesta.status_code == 409


def test_un_donante_y_una_caridad_no_pueden_compartir_correo(cliente):
    """El correo es unico para los dos roles."""
    correo = "compartido@correo.com"
    registrar(cliente, datos_donante(correo=correo))

    respuesta = registrar(cliente, datos_caridad(correo=correo))

    assert respuesta.status_code == 409


# ==================================================================
#  Seguridad
# ==================================================================
def test_la_contrasena_no_se_guarda_en_claro(cliente):
    datos = datos_donante(password="mi-clave-secreta")

    registrar(cliente, datos)

    with SessionLocal() as sesion:
        usuario = sesion.query(Usuario).filter_by(correo=datos["correo"]).one()
    assert usuario.password_hash != "mi-clave-secreta"
    assert "mi-clave-secreta" not in usuario.password_hash


def test_el_token_recibido_sirve_de_verdad(cliente):
    """El token que devuelve el registro abre la API."""
    cuerpo = registrar(cliente, datos_donante()).json()

    respuesta = cliente.get("/api/yo", headers=cabeceras(cuerpo["access_token"]))

    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == "donante"
