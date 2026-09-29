# Donando

Registro de donantes y caridades, con **FastAPI + MySQL + JWT** en Docker.
El frontend es HTML, CSS y JavaScript plano.

- Los usuarios se registran eligiendo un rol: **donante** o **caridad**.
- El formulario pide distintos campos segun el rol.
- Al entrar, cualquier rol ve la misma vista: un grid de tarjetas con las
  caridades registradas (nombre = titulo, causa = subtitulo).
- Al tocar una tarjeta se abre un modal con la informacion completa.
- Las donaciones **no** se hacen dentro de la pagina: los datos de cuenta de
  la caridad se muestran solo como texto.

---

## Como arrancarlo

No hace falta instalar Python ni MySQL. Con Docker Desktop abierto:

```powershell
docker compose up --build
```

La primera vez tarda un poco (descarga las imagenes y MySQL se inicializa).
Cuando veas esto, ya esta listo:

```
[OK] Conectado a MySQL. Se crearon 4 usuarios de ejemplo.
```

Abre **http://localhost:8000**

### Cuentas para probar

Vienen 3 caridades y 1 donante de ejemplo. La contrasena de todas es
**`demo1234`**:

| Correo | Rol | Que ver |
| --- | --- | --- |
| `ninos@donando.com` | caridad | Fundacion Ayuda a Ninos |
| `hogares@donando.com` | caridad | Hogares de la Esperanza |
| `manos@donando.com` | caridad | Manos que Resucitan |
| `laura@donando.com` | donante | No aparece en el listado |

Ojo: si te registras como donante, el correo **no puede** ser uno de esos,
porque el correo no se puede repetir.

### Para detener

```powershell
docker compose stop        # detiene, conserva los datos
docker compose up -d       vuelve a levantar
docker compose down        # quita los contenedores, conserva los datos
docker compose down -v     # ADEMAS borra la base de datos y empieza de cero
```

---

## Cuentas de ejemplo: por que desaparecen

Los datos de ejemplo se insertan **solo si la base esta vacia**. Apenas
registras algo, el arranque siguiente ya no los agrega. Para volver a verlos,
borra todo:

```powershell
docker compose down -v && docker compose up --build -d
```

## Si cambias las claves del `.env`

MySQL crea el usuario **una sola vez**, la primera vez que se inicializa el
volumen. Si despues cambias `DB_PASSWORD` en el `.env`, MySQL sigue con la
clave vieja y la app deja de conectar.

La solucion es recrear el volumen (esto **borra los datos**):

```powershell
docker compose down -v && docker compose up --build -d
```

---

## Estructura

```
├── docker-compose.yml    Los servicios: base de datos, app y pruebas JS
├── Dockerfile            Como se construye la imagen de la app
├── Dockerfile.jest       Como se construye la imagen de las pruebas JS
├── .dockerignore         Lo que no entra en la imagen (incluye el .env)
├── .env                  Credenciales (NO se sube al repositorio)
├── .env.example          Plantilla del .env
│
├── main.py               Servidor FastAPI y rutas de la API
├── config.py             Lee el .env (conexion y clave del JWT)
├── database.py           Conexion con MySQL
├── models.py             Tabla usuarios
├── schemas.py            Validacion de los datos (Pydantic)
├── auth.py               Contrasenas (bcrypt) y JSON Web Tokens
├── seed.py               Caridades de ejemplo para probar
│
├── tests/                Pruebas de la API (pytest)
│   ├── conftest.py       Prepara la base de pruebas y limpia entre pruebas
│   ├── test_auth.py      Contrasenas y tokens
│   ├── test_registro.py  Registro de donante y caridad
│   ├── test_api.py       Login, /api/yo y /api/caridades
│   └── test_seed.py      Datos de ejemplo
├── pytest.ini            Configuracion de pytest
├── requirements-dev.txt  pytest y httpx2 (solo para las pruebas)
├── probar.bat            Atajo para correr las pruebas de Python
│
├── tests-js/             Pruebas del frontend (Jest)
│   ├── ayudas.js         Monta la pagina real y arma el fetch falso
│   ├── comun.test.js     Token, mensajes y llamadas a la API
│   ├── login.test.js     Pestanas, campos por rol, registro y acceso
│   └── caridades.test.js Listado, modal y boton de salir
├── package.json          Dependencias de Jest
├── jest.config.js        Configuracion de Jest
├── Dockerfile.jest       Imagen SOLO para correr Jest
├── probar-js.bat         Atajo para correr las pruebas de JavaScript
│
├── templates/
│   ├── index.html        Registro e inicio de sesion
│   └── inicio.html       Listado de caridades + modal de detalle
└── static/
    ├── css/estilos.css
    └── js/
        ├── comun.js      Funciones compartidas (token, fetch, navegar)
        ├── login.js      Formulario que cambia segun el rol
        └── caridades.js  Tarjetas y modal
```

## La API

La documentacion interactiva esta en **http://localhost:8000/docs**

| Metodo | Ruta             | Token | Que hace                                  |
| ------ | ---------------- | ----- | ----------------------------------------- |
| POST   | `/api/registro`  | no    | Crea un usuario y devuelve su JWT         |
| POST   | `/api/login`     | no    | Revisa la contrasena y devuelve su JWT    |
| GET    | `/api/yo`        | si    | Devuelve quien esta conectado            |
| GET    | `/api/caridades` | si    | Lista las caridades registradas           |

El token se manda en la cabecera `Authorization: Bearer <token>` y el
navegador lo guarda en `localStorage`.

---

## Pruebas

Hay dos suites, y se corren por separado:

| Suite | Que prueba | Atajo | Conteo |
| --- | --- | --- | --- |
| **Python** (`pytest`) | La API: registro, acceso, tokens, datos de ejemplo | `probar` | 87 |
| **JavaScript** (`Jest`) | El frontend: pestanas, formulario, listado y modal | `probar-js` | 100 |

Son **187 pruebas** en total. Las dos se corren en Docker, asi que no
tienes que instalar nada.

---

## Pruebas de Python (pytest)

### La forma facil

Desde la terminal de Visual Studio, en esta carpeta, escribe:

```
probar
```

Y ya esta. Si editaste un archivo de `tests/` o del codigo, primero
reconstruye:

```
probar --reconstruir
```

El script es `probar.bat`. Si el contenedor esta apagado, lo levanta solo.

### A mano

Con la app ya levantada (`docker compose up -d`):

```powershell
docker compose exec app pytest -v
```

Al terminar debe salir:

```
87 passed
```

Si cambiaste un archivo de `tests/`, hay que reconstruir antes de volver a
correrlas, porque las pruebas van dentro de la imagen:

```powershell
docker compose up --build -d
docker compose exec app pytest -v
```

### Correr solo unas pocas

```powershell
docker compose exec app pytest tests/test_registro.py -v   # un archivo
docker compose exec app pytest -k "contrasena" -v          # las que contengan esa palabra
docker compose exec app pytest -x                          # se detiene en el primer fallo
```

### Como leer el resultado

La linea de resumen es la que importa, y esta **abajo del todo**:

```
============================= 87 passed in 33.25s =============================
```

Sin `-v` ves una linea de puntos por archivo. Cada marca significa:

| Marca | Significa |
| --- | --- |
| `.` | paso |
| `F` | fallo (la afirmacion no se cumplio) |
| `E` | error (se rompio antes de poder afirmar) |
| `s` | se salto |
| `x` | fallo inesperado |

Si algo falla, abajo aparece el detalle con el archivo, la linea exacta y el
mensaje. Lo primero que hay que buscar son las lineas que empiezan con
`FAILED:`. Para un resumen mas corto de la traza: `pytest --tb=line`

Ademas, `echo $LASTEXITCODE` despues de correrlas dice si todo fue bien:

| Codigo | Significa |
| --- | --- |
| `0` | pasaron todas |
| `1` | hubo al menos un fallo |
| `2` | las pruebas ni siquiera se pudieron leer |
| `5` | no encontro pruebas |

### Que prueban

| Archivo | Cuantas | Que cubren |
| --- | --- | --- |
| `test_auth.py` | 15 | bcrypt (hashea, verifica, rechaza, contrasenas largas) y el JWT (lleva el rol, expira, rechaza firmas falsas) |
| `test_registro.py` | 35 | Registro de donante y caridad, los campos obligatorios de cada rol, correos y contrasenas invalidos, correos repetidos, y que la contrasena no se guarde en claro |
| `test_api.py` | 23 | Login correcto e incorrecto, `/api/yo`, `/api/caridades`, los 401, y que los dos roles vean la misma lista |
| `test_seed.py` | 14 | Que los ejemplos se siembren solo con la base vacia, y que sus ciudades y bancos existan en el formulario |

### Importante: las pruebas NO tocan tus datos

Las pruebas corren contra una base aparte llamada **`dona_donador_test`**, que
se crea sola, se vacia antes de cada prueba y se borra al terminar. Tu base
real (`dona_donador`) no se abre nunca.

Para crear esa base las pruebas usan la clave de `root` (que ya esta en tu
`.env`), porque el usuario de la app solo tiene permisos sobre `dona_donador`.
Los permisos tambien se los dan ellas solas, asi que no hay nada que
configurar a mano.

### Si editas el codigo y una prueba falla

Las pruebas miran el comportamiento desde afuera, asi que una prueba que falla
no siempre significa que la app este mal: puede ser que cambiaste algo a
proposito. Lee el mensaje antes de "arreglar" el codigo.

Por ejemplo, si agregas una cuarta ciudad al desplegable, las pruebas de
`test_seed.py` no se quebran, porque **leen el desplegable del formulario** en
lugar de una lista fija. Si en cambio cambias el nombre de un campo de la API,
ahi si hay que actualizar las pruebas.

### Sacar las pruebas de la imagen (opcional)

`pytest` y `httpx2` vienen en `requirements-dev.txt` y el `Dockerfile` los
instala, para que las pruebas se puedan correr sin instalar nada. La app no usa
ninguno de los dos. Si vas a desplegar esto en serio, borra del `Dockerfile`:

```dockerfile
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
```

---

## Pruebas de JavaScript (Jest)

Prueban el frontend: que el formulario cambie segun el rol, que el listado
dibuje las tarjetas, que el modal abra y cierre, y que las redireciones
funcionen. Corre en un navegador de mentira (jsdom), **sin levantar la app** y
sin tocar la base de datos.

### La forma facil

Desde la terminal de Visual Studio, en esta carpeta:

```
probar-js
```

La primera vez descarga la imagen de Node y las dependencias de Jest, y tarda
un par de minutos. Despues son unos 9 segundos de principio a fin.

Si cambiaste el `package.json` (por ejemplo, subiste la version de Jest):

```
probar-js --reconstruir
```

El script es `probar-js.bat`.

### A mano

```powershell
docker compose --profile pruebas run --rm tests-js
```

Al terminar debe salir:

```
Test Suites: 3 passed, 3 total
Tests:       100 passed, 100 total
```

El `--profile pruebas` es necesario: es lo que hace que este servicio exista.
Sin el, Docker ni lo menciona, porque normalmente no arranca junto con la app.

### Correr solo unas pocas

En la imagen, Jest es el `ENTRYPOINT`, asi que lo que escribas despues se le
pasa a el:

```powershell
# solo un archivo
docker compose --profile pruebas run --rm tests-js --testPathPatterns login

# solo las pruebas cuyo nombre contenga una palabra
docker compose --profile pruebas run --rm tests-js -t modal

# ver el detalle de cada prueba
docker compose --profile pruebas run --rm tests-js --verbose
```

### Que prueban

| Archivo | Cuantas | Que cubren |
| --- | --- | --- |
| `comun.test.js` | 32 | Guardar, leer y borrar el token; el cuadro de mensaje; marcar campos en rojo; y `api()` por dentro: cabeceras, el 401 que cierra la sesion, el 422 que arma el error campo por campo, el 409 y el 500 |
| `login.test.js` | 40 | Cambio de pestanas, los campos que aparecen y los que se vuelven obligatorios segun el rol, que se manden los datos correctos de donante y de caridad, que la contrasena **no** se recorte, y que un fallo no deje el boton bloqueado |
| `caridades.test.js` | 28 | La barra de arriba, la rejilla de tarjetas, el mensaje de "todavia no hay", el modal (que datos muestra y como se cierra con la X, el fondo o Escape) y el boton de salir |

### Como leer el resultado

La linea de resumen va **abajo del todo**:

```
Test Suites: 3 passed, 3 total
Tests:       100 passed, 100 total
```

| Marca | Significa |
| --- | --- |
| `.` | paso |
| `X` | fallo (la afirmacion no se cumplio) |

Si algo falla, Jest imprime el nombre de la prueba y la linea exacta:

```
  X el modal de detalle > muestra los datos bancarios, que son solo informacion
```

### Que tan lejos llegan

Las pruebas no se prueban a si mismas con una copia del codigo: leen los
archivos de verdad. En `ayudas.js` se monta la plantilla real de
`templates/` y se ejecutan los scripts reales de `static/js/`, asi que si
cambias el HTML o el JS del proyecto, las pruebas lo detectan.

Cada prueba abre su propio `<iframe>`. No es un detalle: los scripts declaran
`const` en el ambito global, y si dos pruebas cargaran el mismo archivo en la
misma ventana, la segunda reventaria con *"Identifier 'TOKEN' has already been
declared"*. El iframe le da a cada prueba una ventana limpia.

Lo unico que las pruebas **no** pueden observar por su cuenta es a donde navega
el codigo: en jsdom `window.location` esta sellado por el estandar y no se
puede ni leer ni espiar. Por eso todas las redirecciones del frontend pasan
por una funcion `navegar(ruta)` en `comun.js`, y las pruebas escuchan ahi. En
el navegador hace exactamente lo mismo que antes (`window.location.href = ruta`),
asi que el comportamiento no cambio.

### Si editas el codigo y una prueba falla

Igual que con pytest: una prueba que falla no siempre significa que la app
este mal. Puede ser que cambiaste algo a proposito. Ademas, las pruebas del
frontend **no necesitan que reconstruyas nada**: los archivos de `static/` y
`templates/` van montados en la imagen de pruebas, asi que edita y vuelve a
correr `probar-js`.

Esto no aplica al `package.json`: si lo cambias, si necesitas `probar-js
--reconstruir`.

### Donde NO hay que instalar nada

Ni en tu maquina ni en tu carpeta hay un `node_modules`. Todo vive dentro de
la imagen de Docker. Eso es a proposito: dentro de OneDrive, las decenas de
miles de archivos pequenos de Node hacen que todo se vuelva lento y a veces
se traben con errores de archivo ocupado.

Ademas, esta imagen de pruebas no tiene nada que ver con la de la app, asi que
`probar-js` funciona aunque la app este apagada. Lo unico que comparte con la
app son los archivos de `static/` y `templates/`, que van montados en solo
lectura.

---

## Cambiar el codigo

El codigo va **dentro** de la imagen, no montado como carpeta. Si editas un
archivo Python, hay que reconstruir:

```powershell
docker compose up --build -d
```

Los archivos de `templates/` y `static/` tambien necesitan reconstruirse.
Despues refrescas el navegador con **Ctrl+F5** para no ver la version vieja
desde la cache.

---

## Problemas frecuentes

**`Access denied for user 'dona_user'`**
Las claves del `.env` no coinciden con las que se creo el volumen. Casi
siempre significa que cambiaste el `.env` despues del primer arranque.
Solucion: `docker compose down -v && docker compose up --build -d`

**El puerto 8000 esta ocupado**
Cambia `8000:8000` por `8080:8000` en `docker-compose.yml` (solo la parte
izquierda) y abre http://localhost:8080

**La app dice que no se pudo conectar con MySQL**
Revisa `docker compose ps` y `docker compose logs db`. La primera vez MySQL
tarda unos segundos en initializing.

**Quiero empezar de cero, con la base vacia**
`docker compose down -v` y despues `docker compose up --build -d`
