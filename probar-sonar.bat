@echo off
REM ============================================================
REM  Donando - calidad del codigo con SonarQube.
REM
REM  Uso desde la terminal de Visual Studio, en esta carpeta:
REM      probar-sonar
REM          Levanta SonarQube si hace falta, analiza el codigo
REM          y te dice donde ver el reporte.
REM
REM      probar-sonar --levantar
REM          Solo levanta SonarQube y abre el navegador. Util
REM          para no gastar el analisis si solo quieres ver la
REM          pagina.
REM
REM      probar-sonar --limpiar
REM          Apaga SonarQube y BORRA todo su historial de
REM          analisis. Ojo: esto borra los resultados.
REM
REM  El reporte se ve en el navegador, en http://localhost:9001
REM  (no es un archivo: es la pagina del servidor).
REM
REM  -----------------------------------------------------------------
REM  LA PRIMERA VEZ hay que crear un token, porque el scanner no
REM  puede analizar sin autenticarse. El script lo pide:
REM
REM      1. Entra a http://localhost:9001
REM      2. La primera entrada es admin / admin, y SonarQube te
REM         OBLIGA a cambiar la contrasena. Es normal, no es un
REM         error.
REM      3. Arriba a la derecha: tu avatar > My Account >
REM         Security > Generate Token. Ponle un nombre (por
REM         ejemplo "donandon") y copia el texto que empieza con
REM         squ_ (asi, con una sola "q" y sin "p"). Ojo: en la
REM         version 26 el prefijo es "squ_", no el "squp_" de las
REM         versiones viejas.
REM      4. En la terminal de PowerShell, guardalo:
REM            [Environment]::SetEnvironmentVariable("SONAR_TOKEN","squp_...","User")
REM         Ojo: el token REAL no se pega aqui en el chat ni se
REM         escribe en ningun archivo del proyecto.
REM
REM  El token vive en el registro de Windows, no en el repo, asi
REM  que nunca se sube a GitHub.
REM ============================================================
setlocal
cd /d "%~dp0"

set PROYECTO=donadon-sonar
set ARCHIVO=docker-compose.sonar.yml
set URL=http://localhost:9001

if /i "%~1"=="--limpiar" goto solo_limpiar
if /i "%~1"=="--levantar" goto solo_levantar

REM ------------------------------------------------------------
REM  El token: sin esto el scanner no arranca.
REM
REM  El mensaje importa: si alguien corre esto sin saber que
REM  falta el token, ver un error de buildx no ayuda nada.
REM ------------------------------------------------------------
if "%SONAR_TOKEN%"=="" goto falta_token

echo.
echo [1/3] Levantando SonarQube (puede tardar un minuto la primera vez)...
docker compose -p %PROYECTO% -f %ARCHIVO% up -d sonarqube
if errorlevel 1 goto fallo

echo.
echo [2/3] Analizando el codigo...
echo.
docker compose -p %PROYECTO% -f %ARCHIVO% --profile scan run --rm scanner
if errorlevel 1 goto fallo

echo.
echo [3/3] Listo.
echo.
echo   El reporte esta en:  %URL%
echo.
echo   Entra ahi, busca el proyecto "Donando" y ahi estan los
echo   problemas, los duplicados y la deuda tecnica.
echo.
start "" "%URL%"
goto fin

REM ------------------------------------------------------------
REM  Solo levantar
REM ------------------------------------------------------------
:solo_levantar
echo.
echo Levantando SonarQube...
docker compose -p %PROYECTO% -f %ARCHIVO% up -d sonarqube
if errorlevel 1 goto fallo
echo.
echo   SonarQube queda en: %URL%
start "" "%URL%"
goto fin

REM ------------------------------------------------------------
REM  Limpiar
REM ------------------------------------------------------------
:solo_limpiar
echo.
echo Esto apaga SonarQube y BORRA todo su historial de analisis.
echo Se queda como si nunca hubieras analizado nada.
echo.
set /p CONFIRMAR=De verdad lo quieres? (escribe SI para confirmar): 
if /i not "%CONFIRMAR%"=="SI" (
    echo Cancelado. No se boro nada.
    goto fin
)
docker compose -p %PROYECTO% -f %ARCHIVO% down -v --remove-orphans
goto fin

REM ------------------------------------------------------------
REM  Sin token
REM ------------------------------------------------------------
:falta_token
echo.
echo ============================================================
echo  FALTA EL TOKEN DE SONARQUEBE
echo ============================================================
echo.
echo El scanner no puede analizar sin autenticarse. Se crea una
echo sola vez y se guarda en tu usuario de Windows:
echo.
echo   1. Abre   %URL%
echo   2. Entra con admin / admin (SonarQube te va a pedir
echo      cambiar la contrasena: es normal, no un error)
REM El "^" antes de ">" no sobra: en un echo de Windows, ">"
REM significa redirigir la salida a un archivo. Sin el, este
REM paso no se imprime: se crea un archivo llamado "Generate".
echo   3. Avatar ^> My Account ^> Security ^> Generate Token
echo   4. Copia el token (empieza con squp_)
echo   5. En PowerShell ejecuta:
echo.
echo      [Environment]::SetEnvironmentVariable("SONAR_TOKEN","squ_TU_TOKEN","User")
echo.
echo Cierra esta terminal y abre una nueva, para que Windows lea
echo el token recien guardado.
echo.
echo Si ya lo habias hecho y sigue fallando, casi siempre es que
echo la terminal es vieja: cerrarla y abrir otra lo arregla.
echo.
goto fin

:fallo
echo.
echo ============================================================
echo  ALGO FUE MAL
echo ============================================================
echo.
echo Si el error menciona "sonar.token" o "Unauthorized", es el
echo token: vuelve a generarlo en %URL% y guardalo otra vez.
echo.
echo Para ver el detalle completo, revisa los logs:
echo   docker compose -p %PROYECTO% -f %ARCHIVO% logs sonarqube
echo.

:fin
endlocal
