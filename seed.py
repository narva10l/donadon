"""Caridades de ejemplo para que el listado no salga vacio al probar."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import hash_password
from models import Usuario

# Todas con la contrasena "demo1234"
CLAVE_DEMO = "demo1234"

EJEMPLOS = [
    {
        "rol": "caridad",
        "nombre": "Fundacion Ayuda a Ninos",
        "correo": "ninos@donando.com",
        "causa": "Ninos con cancer",
        "ubicacion": "Torreon, Coahuila",
        "info_extra": (
            "Ayudamos a 300 ninos con tratamientos y medicamentos, y tambien "
            "damos apoyo psicologico a sus familias."
        ),
        "cuenta_numero": "123-456-7890",
        "cuenta_titular": "Fundacion Ayuda a Ninos",
        "cuenta_banco": "BBVA",
    },
    {
        "rol": "caridad",
        "nombre": "Hogares de la Esperanza",
        "correo": "hogares@donando.com",
        "causa": "Adulto mayor abandonado",
        "ubicacion": "Gomez, Durango",
        "info_extra": (
            "Alojamos a 120 adultos mayores que no tienen donde vivir y les damos "
            "alimentacion, medicina y acompanamiento."
        ),
        "cuenta_numero": "987-654-3210",
        "cuenta_titular": "Asociacion Hogares de la Esperanza",
        "cuenta_banco": "Nu",
    },
    {
        "rol": "caridad",
        "nombre": "Manos que Resucitan",
        "correo": "manos@donando.com",
        "causa": "Desastres naturales",
        "ubicacion": "Lerdo, Durango",
        "info_extra": (
            "Llegamos primero a las zonas afectadas por inundaciones y "
            "terremotos con agua potable, alimentos y kits de higiene."
        ),
        "cuenta_numero": "555-123-4567",
        "cuenta_titular": "Fundacion Manos que Resucitan",
        "cuenta_banco": "Banregio",
    },
    {
        "rol": "donante",
        "nombre": "Laura",
        "apellido": "Gomez",
        "correo": "laura@donando.com",
    },
]


def sembrar_si_esta_vacia(db: Session) -> int:
    """Inserta los datos de ejemplo solo si no hay ninguno.

    Devuelve cuantos usuarios creo (0 si la base ya tenia datos).
    """
    total = db.scalar(select(func.count()).select_from(Usuario))
    if total:
        return 0

    clave = hash_password(CLAVE_DEMO)

    for datos in EJEMPLOS:
        datos = dict(datos)
        db.add(Usuario(password_hash=clave, **datos))

    db.commit()
    return len(EJEMPLOS)


