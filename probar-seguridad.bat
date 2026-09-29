@echo off
REM ============================================================
REM  Donando - revision de seguridad (OWASP)
REM
REM  Uso desde la terminal de Visual Studio, en esta carpeta:
REM      probar-seguridad
REM          Fases 1, 2 y 3. Son seguras: no atacan nada.
REM
REM      probar-seguridad --activo
REM          Lo anterior MAS el escaneo activo de ZAP, que si
REM          manda cargas de ataque reales (inyeccion SQL, XSS).
REM
REM      probar-seguridad --limpiar
REM          Borra la copia desechable y sus datos.
REM
REM  Tus datos de verdad NO se tocan nunca: viven en el volumen
REM  "datos_mysql" de docker-compose.yml, y estarevisa corre
REM  sobre una base aparte llamada "dona_seguridad_efimera" que
REM  se destruye al terminar.
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

set PROYECTO=donando-seguridad
set ARCHIVO=docker-compose.seguridad.yml
set CARPETA=seguridad
set LOG=%TEMP%\donando_seguridad.txt

if /i "%~1"=="--limpiar" goto solo_limpiar
if /i "%~1"=="--activo" goto con_activo

echo ============================================================
echo   Donando - revision de seguridad (OWASP)
echo ============================================================
echo.
echo [..] Fase 1/3  Vulnerabilidades en las librerias (pip-audit)
echo [..] Fase 2/3  Errores de seguridad en el codigo (bandit)
echo [..] Fase 3/3  OWASP ZAP en modo pasivo: rastrea, NO ataca
echo.
echo     Los reportes quedan en la carpeta "%CARPETA%\".
echo     Tus datos de verdad no se tocan.
echo.
goto arrancar

:con_activo
echo ============================================================
echo   Donando - revision de seguridad (OWASP) - ESCANEO ACTIVO
echo ============================================================
echo.
echo  OJO: la fase 4 manda cargas de ataque reales (inyeccion
echo  SQL, XSS, traversal) contra la app. Por eso corre contra
echo  una COPIA desechable con su propia base de datos, que se
echo  borra al terminar.
echo.
echo     Tus datos de verdad no se tocan.
echo.
echo     La copia arranca en http://localhost:8081, no en el 8000.
echo.
pause
goto arrancar

:solo_limpiar
echo [..] Borrando la copia desechable y sus datos...
docker compose -p %PROYECTO% -f %ARCHIVO% down -v --remove-orphans >nul 2>&1
docker image prune -f --filter "label=com.docker.compose.project=%PROYECTO%" >nul 2>&1
echo [OK] Listo. La copia de seguridad ya no existe.
echo     Tus datos de verdad siguen intactos.
exit /b 0

:arrancar
if not exist "%CARPETA%" mkdir "%CARPETA%"

REM ------------------------------------------------------------
REM  FASE 1 y 2: revisar el codigo. No levantan base de datos.
REM ------------------------------------------------------------
echo ============================================================
echo   Fase 1 y 2 - Revisar el codigo
echo ============================================================
echo.
echo [..] Preparando las herramientas. La primera vez tarda un
echo     par de minutos; despues va rapido.
docker compose -p %PROYECTO% -f %ARCHIVO% --profile analisis build analisis >"%LOG%" 2>&1
if errorlevel 1 goto fallo

echo [..] Buscando vulnerabilidades conocidas en las librerias...
docker compose -p %PROYECTO% -f %ARCHIVO% --profile analisis run --rm analisis ^
  "pip-audit -r /w/requirements.txt -f columns > /seguridad/pip-audit.txt 2>&1; true" >nul 2>&1
docker compose -p %PROYECTO% -f %ARCHIVO% --profile analisis run --rm analisis ^
  "pip-audit -r /w/requirements.txt -f json -o /seguridad/pip-audit.json >/dev/null 2>&1; true" >nul 2>&1
if exist "%CARPETA%\pip-audit.txt" (echo [OK] pip-audit terminado.) else (echo [X] pip-audit fallo.)

echo [..] Buscando errores de seguridad en el codigo...
docker compose -p %PROYECTO% -f %ARCHIVO% --profile analisis run --rm analisis ^
  "bandit -r /w/main.py /w/auth.py /w/config.py /w/database.py /w/models.py /w/schemas.py /w/seed.py -f txt -o /seguridad/bandit.txt >/dev/null 2>&1; true" >nul 2>&1
docker compose -p %PROYECTO% -f %ARCHIVO% --profile analisis run --rm analisis ^
  "bandit -r /w/main.py /w/auth.py /w/config.py /w/database.py /w/models.py /w/schemas.py /w/seed.py -f json -o /seguridad/bandit.json >/dev/null 2>&1; true" >nul 2>&1
if exist "%CARPETA%\bandit.txt" (echo [OK] bandit terminado.) else (echo [X] bandit fallo.)

echo.
goto levantando

:levantando
REM ------------------------------------------------------------
REM  Levantar la COPIA desechable: base nueva en el puerto 8081.
REM ------------------------------------------------------------
echo ============================================================
echo   Fase 3 - Levantar la copia desechable
echo ============================================================
echo.
echo [..] Construyendo la copia de la app. La primera vez tarda un
echo     par de minutos.
docker compose -p %PROYECTO% -f %ARCHIVO% build app >"%LOG%" 2>&1
if errorlevel 1 goto fallo

echo [..] Levantando la base de datos de mentira y la copia...
docker compose -p %PROYECTO% -f %ARCHIVO% up -d db app >>"%LOG%" 2>&1
if errorlevel 1 goto fallo

echo [..] Esperando a que la copia responda (tarda ~20 segundos)...
call :esperar http://127.0.0.1:8081/ 60
if errorlevel 1 goto fallo

echo [OK] La copia esta de pie en http://localhost:8081
echo     (es un GEMELO de tu app, no tu app: aqui van los ataques)
echo.

echo ============================================================
echo   Fase 3 - OWASP ZAP, modo pasivo (rastrea, NO ataca)
echo ============================================================
echo.
echo [..] Descargando OWASP ZAP la primera vez (son ~1.5 GB).
echo     Despues queda guardado y va rapido.
docker compose -p %PROYECTO% -f %ARCHIVO% --profile escaneo run --rm zap ^
  "python3 /zap/zap-baseline.py -t http://app:8000 -I -l WARN -s -m 2 -r /zap/wrk/zap-linea-base.html -J /zap/wrk/zap-linea-base.json -w /zap/wrk/zap-linea-base.md"
set RESULTADO=%errorlevel%

if not exist "%CARPETA%\zap-linea-base.html" goto fallo_zap

echo.
echo [OK] ZAP pasivo terminado.
echo.

if not "%~1"=="--activo" goto resumen

echo ============================================================
echo   Fase 4 - OWASP ZAP, ESCANEO ACTIVO (si ataca)
echo ============================================================
echo.
echo [..] Mandando cargas de ataque contra la COPIA. Puede tardar
echo     hasta 15 minutos. No le aparezcas a la base real.
docker compose -p %PROYECTO% -f %ARCHIVO% --profile escaneo run --rm zap ^
  "python3 /zap/zap-full-scan.py -t http://app:8000 -I -l WARN -s -m 2 -r /zap/wrk/zap-activo.html -J /zap/wrk/zap-activo.json -w /zap/wrk/zap-activo.md"

if not exist "%CARPETA%\zap-activo.html" goto fallo_zap
echo.
echo [OK] ZAP activo terminado.

:resumen
echo.
echo ============================================================
echo   Limpiando la copia desechable
echo ============================================================
echo.
docker compose -p %PROYECTO% -f %ARCHIVO% down -v --remove-orphans >nul 2>&1
echo [OK] Copia borrada. Tus datos de verdad nunca se tocaron.
echo.
echo ============================================================
echo   Resumen de lo que hay en la carpeta "%CARPETA%\"
echo ============================================================
echo.
if exist "%CARPETA%\pip-audit.txt" (
    echo --- pip-audit: librerias con vulnerabilidades conocidas ---
    type "%CARPETA%\pip-audit.txt"
    echo.
) else (
    echo --- pip-audit: sin librerias vulnerables ---
    echo.
)

if exist "%CARPETA%\zap-activo.html" (
    echo --- ZAP activo: reporte completo en seguridad\zap-activo.html ---
    echo     El resumen con lo importante esta en seguridad\resumen.txt
) else if exist "%CARPETA%\zap-linea-base.html" (
    echo --- ZAP pasivo: reporte en seguridad\zap-linea-base.html ---
) else (
    echo --- ZAP: no se genero reporte ---
)
echo.
echo El resumen escrito esta en:  %CD%\%CARPETA%\resumen.txt
echo El HTML se abre con doble clic desde Visual Studio.
echo.
del "%LOG%" >nul 2>&1
exit /b 0

:fallo_zap
echo.
echo [X] ZAP no pudo terminar. Mira el detalle:
docker compose -p %PROYECTO% -f %ARCHIVO% logs app --tail 30 2>&1
goto limpiar_y_salir

:fallo
echo.
echo [X] Algo fallo. Esto casi siempre es que Docker Desktop no
echo     esta abierto, o que no hay internet para descargar las
echo     herramientas. El detalle:
echo.
type "%LOG%"
goto limpiar_y_salir

:limpiar_y_salir
echo.
echo [..] Borrando la copia desechable para no dejar nada a medias...
docker compose -p %PROYECTO% -f %ARCHIVO% down -v --remove-orphans >nul 2>&1
del "%LOG%" >nul 2>&1
echo [OK] Tus datos de verdad siguen intactos.
exit /b 1

REM ------------------------------------------------------------
REM  Espera a que una URL responda. Devuelve 1 si se agota el
REM  tiempo. El parametro 1 son los segundos que espera.
REM ------------------------------------------------------------
:esperar
set URL=%~1
set SEG=%~2
set /a n=0
:esperar_bucle
curl -s -o nul -w "%%{http_code}" "%URL%" 2>nul | findstr /r "^[2345]" >nul
if not errorlevel 1 exit /b 0
set /a n+=1
if !n! geq !SEG! exit /b 1
timeout /t 3 /nobreak >nul
goto esperar_bucle
