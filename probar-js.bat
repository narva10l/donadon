@echo off
REM ============================================================
REM  Donando - corre las pruebas de JavaScript (Jest)
REM
REM  Uso desde la terminal de Visual Studio, en esta carpeta:
REM      probar-js
REM      probar-js --reconstruir    (solo si cambiaste package.json)
REM
REM  Solo prueba el frontend. Para lo de Python, usa: probar
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM La salida de docker se guarda aparte para no ensuciar la
REM pantalla. Si algo falla, se muestra completa.
set LOG=%TEMP%\donando_docker_js.txt

echo ============================================================
echo   Donando - pruebas de JavaScript
echo ============================================================
echo.

if /i "%~1"=="--reconstruir" goto reconstruir

echo [..] Corriendo las pruebas...
echo.
goto correr

:reconstruir
echo [..] Preparando la imagen de pruebas. La primera vez descarga
echo     node y las dependencias de Jest, y tarda un par de minutos.
docker compose --profile pruebas build tests-js >"%LOG%" 2>&1
if errorlevel 1 goto fallo
echo [OK] Imagen lista.
echo.

:correr
REM El perfil "pruebas" es lo que hace que este servicio exista:
REM normalmente no arranca junto con la app.
docker compose --profile pruebas run --rm tests-js
set RESULTADO=!errorlevel!

echo.
if !RESULTADO!==0 (
    echo [OK] Todas las pruebas pasaron.
) else (
    echo [X] Hubo fallos. Mira las lineas que empiezan con una X
    echo     o con un punto, que ahi esta el nombre de la prueba.
)

if exist "%LOG%" del "%LOG%" >nul 2>&1
exit /b !RESULTADO!

:fallo
echo.
echo [X] Docker no pudo arrancar. Esto casi siempre es que Docker
echo     Desktop no esta abierto. El detalle:
echo.
type "%LOG%"
del "%LOG%" >nul 2>&1
exit /b 1
