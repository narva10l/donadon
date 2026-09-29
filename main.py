"""
Donando - servidor principal.

Para arrancarlo con Docker:
    docker compose up --build
"""

import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth import crear_token, get_usuario_actual, hash_password, verify_password
from config import BASE_DIR
from database import Base, SessionLocal, db_lista, engine, get_db
from models import Usuario
from schemas import CaridadOut, LoginRequest, RegistroRequest, TokenOut, YoOut
from seed import sembrar_si_esta_vacia

# Cuanto insistimos esperando a que MySQL este listo
REINTENTOS = 20
ESPERA_SEGUNDOS = 3


def esperar_base_de_datos():
    """Crea las tablas esperando a que MySQL responda.

    MySQL puede tardar un buen rato en arrancar y se queda
    escuchando solo por socket durante la inicializacion, asi que
    insistimos un rato en vez de fallar en el primer intento.
    """
    for intento in range(1, REINTENTOS + 1):
        try:
            Base.metadata.create_all(bind=engine)
            return None
        except SQLAlchemyError as error:
            if intento == REINTENTOS:
                return error
            if intento == 1:
                print("[..] MySQL aun no responde, esperando...")
            time.sleep(ESPERA_SEGUNDOS)
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Al arrancar la app se crean las tablas si no existen.

    Si MySQL no esta disponible, no se tumba el servidor: se avisa por
    consola y las rutas de la API responden con un 503 explicando que
    falta configurar la base de datos.
    """
    global db_lista

    error = esperar_base_de_datos()

    if error is None:
        db_lista = True
        with SessionLocal() as sesion:
            creados = sembrar_si_esta_vacia(sesion)

        if creados:
            print(f"[OK] Conectado a MySQL. Se crearon {creados} usuarios de ejemplo.")
        else:
            print("[OK] Conectado a MySQL. Tablas listas.")

    else:
        db_lista = False
        detalle = str(error).splitlines()[0]
        print("=" * 62)
        print("[AVISO] No se pudo conectar con MySQL.")
        print(f"        {detalle}")
        print("        Revisa que Docker este corriendo:")
        print("            docker compose up --build")
        print("        Las paginas abriran, pero la API no tendra datos.")
        print("=" * 62)
    yield


app = FastAPI(
    title="Donando",
    description="Registro de donantes y caridades.",
    version="1.0.0",
    lifespan=lifespan,
)

# Permite llamado desde el navegador durante el desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


# ==================================================================
# PAGINAS
# ==================================================================
@app.get("/", include_in_schema=False)
def pagina_inicio(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/inicio", include_in_schema=False)
def pagina_caridades(request: Request):
    return templates.TemplateResponse(request, "inicio.html")


# ==================================================================
# API
# ==================================================================
@app.post("/api/registro", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def registrar(datos: RegistroRequest, db: Session = Depends(get_db)):
    """Crea un usuario (donante o caridad) y devuelve su JWT."""
    correo = datos.correo.lower().strip()

    existente = db.query(Usuario).filter(Usuario.correo == correo).first()
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese correo.",
        )

    usuario = Usuario(
        rol=datos.rol,
        nombre=datos.nombre,
        correo=correo,
        password_hash=hash_password(datos.password),
        # donante
        apellido=datos.apellido,
        # caridad
        causa=datos.causa,
        ubicacion=datos.ubicacion,
        info_extra=datos.info_extra,
        cuenta_numero=datos.cuenta_numero,
        cuenta_titular=datos.cuenta_titular,
        cuenta_banco=datos.cuenta_banco,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    return TokenOut(
        access_token=crear_token(usuario),
        rol=usuario.rol,
        nombre=usuario.nombre,
        correo=usuario.correo,
    )


@app.post("/api/login", response_model=TokenOut)
def iniciar_sesion(datos: LoginRequest, db: Session = Depends(get_db)):
    """Revisa el correo y la contrasena, y devuelve el JWT."""
    correo = datos.correo.lower().strip()

    usuario = db.query(Usuario).filter(Usuario.correo == correo).first()
    # el mismo mensaje para correo inexistente y contrasena mala,
    # asi nadie puede averiguar que correos estan registrados
    if usuario is None or not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contrasena incorrectos.",
        )

    return TokenOut(
        access_token=crear_token(usuario),
        rol=usuario.rol,
        nombre=usuario.nombre,
        correo=usuario.correo,
    )


@app.get("/api/yo", response_model=YoOut)
def mi_usuario(usuario: Usuario = Depends(get_usuario_actual)):
    """Revisa que el token siga siendo valido y devuelve quien es."""
    return YoOut.model_validate(usuario)


@app.get("/api/caridades", response_model=list[CaridadOut])
def listar_caridades(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_usuario_actual),
):
    """Lista todas las caridades registradas. Requiere token."""
    caridades = (
        db.query(Usuario)
        .filter(Usuario.rol == "caridad")
        .order_by(Usuario.creado_en.desc(), Usuario.id.desc())
        .all()
    )
    return [CaridadOut.model_validate(c) for c in caridades]
