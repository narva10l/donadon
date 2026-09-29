/* ==========================================================
   Funciones que usan las dos paginas
   ========================================================== */

const TOKEN = "donando_token";

/**
 * Cambia de pagina.
 *
 * Todas las redirecciones pasan por aqui en lugar de escribir
 * directo `window.location.href`. En un navegador da exactamente lo
 * mismo, y asi las pruebas pueden comprobar a donde se va: en jsdom
 * `window.location` esta sellado y no se puede ni leer ni espiar.
 */
function navegar(ruta) {
  window.location.href = ruta;
}

/** Devuelve el token guardado, o null si no hay sesion iniciada. */
function leerToken() {
  return localStorage.getItem(TOKEN);
}

/** Guarda el token y lo recordamos para las otras peticiones. */
function guardarToken(token) {
  localStorage.setItem(TOKEN, token);
}

/** Cierra la sesion en el navegador. */
function borrarToken() {
  localStorage.removeItem(TOKEN);
}

/** Devuelve el valor de un input del formulario (con espacios ya limpios). */
function valor(form, nombre) {
  const campo = form.elements[nombre];
  return campo ? campo.value.trim() : "";
}

/** Muestra un mensaje arriba del formulario. */
function mostrarMensaje(texto, tipo = "error") {
  const caja = document.getElementById("mensaje");
  caja.textContent = texto;
  caja.className = "mensaje " + tipo;
}

/** Oculta el mensaje de error. */
function limpiarMensaje() {
  const caja = document.getElementById("mensaje");
  caja.textContent = "";
  caja.className = "mensaje oculto";
}

/** Marca en rojo los campos que falten, usando el texto de la API. */
function marcarInvalidos(form, textos) {
  form.querySelectorAll(".invalido").forEach((c) => c.classList.remove("invalido"));
  textos.forEach((texto) => {
    const campo = [...form.querySelectorAll(".campo")].find((c) =>
      c.textContent.toLowerCase().includes(texto)
    );
    if (campo) {
      const input = campo.querySelector("input, textarea");
      if (input) input.classList.add("invalido");
    }
  });
}

/**
 * Habla con la API. Si devuelve 401 (token vencido o ausente)
 * limpia la sesion y vuelve al login.
 */
async function api(ruta, opciones = {}) {
  const cabeceras = { "Content-Type": "application/json" };
  const token = leerToken();
  if (token) cabeceras.Authorization = "Bearer " + token;

  const respuesta = await fetch(ruta, {
    method: opciones.method || "GET",
    headers: cabeceras,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });

  if (respuesta.status === 401 && ruta !== "/api/login" && ruta !== "/api/registro") {
    borrarToken();
    navegar("/");
    throw new Error("sesion vencida");
  }

  // 422 = Pydantic encontro campos faltantes o con mal formato
  if (respuesta.status === 422) {
    const datos = await respuesta.json();
    const problemas = (datos.detail || []).map((d) => {
      const mensaje = (d.msg || "").replace(/Value error, /, "");
      // cuando la regla depende del rol, Pydantic no dice que campo es
      // y deja loc vacio. En ese caso solo mostramos el mensaje.
      const loc = Array.isArray(d.loc) ? d.loc : [];
      return { campo: loc[loc.length - 1] || "", mensaje };
    });
    const texto = problemas
      .map((p) => (p.campo ? `${p.campo}: ${p.mensaje}` : p.mensaje))
      .join(" | ");
    throw Object.assign(new Error(texto), {
      campos: problemas.map((p) => p.campo).filter(Boolean),
    });
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new Error(datos.detail || "Ocurrio un error inesperado.");
  }

  return respuesta.json();
}
