@echo off
REM ============================================================
REM  Donando - corre las pruebas automaticas (pytest)
REM
REM  Uso desde la terminal de Visual Studio, en esta carpeta:
REM      probar
REM      probar --reconstruir    (si editaste pruebas o codigo)
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Archivo temporal donde se guarda la salida de docker, para no
REM ensuciar la pantalla. Si algo falla, se muestra completa.
set LOG=%TEMP%\donando_docker.txt

echo ============================================================
echo   Donando - pruebas automaticas
echo ============================================================
echo.

if /i "%~1"=="--reconstruir" goto reconstruir

REM Si el contenedor de la app no esta arriba, se levanta solo.
docker compose exec -T app echo ok >nul 2>&1
if errorlevel 1 goto levantar
echo [..] Contenedores arriba. Corriendo las pruebas...
echo.
goto correr

:reconstruir
echo [..] Reconstruyendo la imagen, esto tarda un poco...
docker compose up --build -d >"%LOG%" 2>&1
if errorlevel 1 goto fallo
echo [OK] Imagen reconstruida.
echo.
goto correr

:levantar
echo [..] El contenedor no estaba arriba, levantando...
docker compose up -d >"%LOG%" 2>&1
if errorlevel 1 goto fallo
echo [OK] Contenedores arriba.
echo.

:correr
docker compose exec app pytest -v
set RESULTADO=!errorlevel!

echo.
if !RESULTADO!==0 (
    echo [OK] Todas las pruebas pasaron.
) else (
    echo [X] Hubo fallos. Busca las lineas que empiezan con FAILED.
)
del "%LOG%" >nul 2>&1
exit /b !RESULTADO!

:fallo
echo.
echo [X] Docker no pudo arrancar. Esto casi siempre es que Docker
echo     Desktop no esta abierto. El detalle:
echo.
type "%LOG%"
del "%LOG%" >nul 2>&1
exit /b 1
