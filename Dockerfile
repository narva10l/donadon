FROM python:3.13-slim

# Evita que Python escriba archivos .pyc y que la salida quede
# bloqueada en la consola (util para ver los logs de docker).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Primero las dependencias: si no cambia el codigo, Docker reutiliza
# esta capa y no las reinstala en cada build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Herramientas para correr las pruebas (pytest y httpx2, que necesita
# el TestClient de FastAPI). Si esta imagen se va a desplejar en serio,
# borra estas tres lineas: la app no usa nada de aqui.
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

# Despues el codigo.
COPY . .

EXPOSE 8000

# --host 0.0.0.0 es obligatorio: si se queda en 127.0.0.1
# (el valor por defecto) el navegador de Windows no puede entrar.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
