/* ==========================================================
   Utilidades compartidas por las pruebas.

   El frontend es JS plano que se carga con <script src>. Estas
   funciones montan la PAGINA REAL (desde templates/) dentro de un
   iframe y ejecutan los SCRIPTS REALES (desde static/js/), sin
   inventar una copia de nada.

   --- Por que un iframe y no el document principal ---------------

   Los scripts del proyecto declaran cosas en el ambito global:

       const TOKEN = "donando_token";        // comun.js
       const formRegistro = ...;             // login.js
       const rejilla = ...;                  // caridades.js

   Si se cargaran dos veces en la misma ventana, la segunda.load
   reventaria con "Identifier 'TOKEN' has already been declared",
   porque `const` a nivel superior vive en el ambito global lexico
   de la ventana y no se puede volver a declarar.

   Cada iframe es una ventana nueva: un ambito global limpio. Por eso
   cada prueba abre su propio iframe y queda aislada de las demas.

   Y de paso el `localStorage` tambien es el del iframe, asi que una
   prueba no puede dejar sesion iniciada para la siguiente.
   ========================================================== */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

const RUTA_TEMPLATES = path.join(RAIZ, "templates");
const RUTA_SCRIPTS = path.join(RAIZ, "static", "js");

/** Lee un script real de static/js. */
function leerScript(nombre) {
  return fs.readFileSync(path.join(RUTA_SCRIPTS, nombre), "utf8");
}

/** Lee una plantilla real de templates/. */
function leerPlantilla(nombre) {
  return fs.readFileSync(path.join(RUTA_TEMPLATES, nombre), "utf8");
}

/**
 * Arma una respuesta de fetch con lo justo que usa el frontend:
 * `status`, `ok` y `json()`.
 */
function respuestaFalsa(opciones = {}) {
  const status = opciones.status ?? 200;
  const cuerpo = opciones.cuerpo ?? {};

  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(cuerpo),
  };
}

/**
 * Crea un mock de fetch. Acepta una respuesta o una lista; con lista
 * va encadenando y la ultima se repite.
 */
function crearFetch(respuestas) {
  const lista = Array.isArray(respuestas) ? respuestas : [respuestas];

  return jest.fn(() => {
    const siguiente = lista.length > 1 ? lista.shift() : lista[0];
    return Promise.resolve(respuestaFalsa(siguiente));
  });
}

/**
 * Abre una pagina real en un iframe y deja sus scripts cargados.
 *
 * @param {object} opciones
 * @param {string} opciones.plantilla   "index.html" | "inicio.html"
 * @param {string[]} opciones.scripts   "comun.js", "login.js", ...
 * @param {object|Array} [opciones.respuestas]  lo que conteste fetch
 * @param {string} [opciones.token]    token a dejar en localStorage
 */
function abrirPagina(opciones) {
  const { plantilla, scripts, respuestas = [], token = null } = opciones;

  // --- la ventana nueva ---
  const marco = document.createElement("iframe");
  document.body.appendChild(marco);
  const win = marco.contentWindow;
  const doc = win.document;

  // Los iframes son ventanas nuevas (cada una con sus propias
  // funciones y constantes), pero NO tienen localStorage propia:
  // todas comparten el almacenamiento del mismo origen. Por eso se
  // vacia aqui, o el token de una prueba se le filtraria a la
  // siguiente.
  win.localStorage.clear();

  // El HTML real, sin los <script src>: aqui no hay servidor y jsdom
  // no podria descargarlos.
  const html = leerPlantilla(plantilla);
  const cuerpo = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
  const claseBody = (html.match(/<body[^>]*class="([^"]*)"/i) || [, ""])[1];

  doc.body.className = claseBody;
  doc.body.innerHTML = cuerpo.replace(/<script[\s\S]*?<\/script>/gi, "");

  // El fetch del iframe, no el global de Jest: el codigo corre dentro
  // de esa ventana y busca `fetch` en ella.
  const mockFetch = crearFetch(respuestas);
  win.fetch = mockFetch;

  if (token) {
    win.localStorage.setItem("donando_token", token);
  }

  // --- registro de navegaciones ---
  // Toda redireccion del frontend pasa por navegar(), asi que se
  // reemplaza esa funcion por una que solo anota. Se hace DESPUES de
  // cargar comun.js, porque al declararse `function navegar` pisaria
  // una espia puesta antes.
  const destinos = [];

  scripts.forEach((nombre) => {
    const etiqueta = doc.createElement("script");
    etiqueta.textContent = leerScript(nombre);
    doc.body.appendChild(etiqueta);

    if (nombre === "comun.js") {
      win.navegar = (ruta) => {
        destinos.push(ruta);
      };
    }
  });

  // --- cositas para que las pruebas se lean bien ---
  const pag = {
    marco,
    win,
    doc,
    fetch: mockFetch,
    destinos,

    $(selector) {
      return doc.querySelector(selector);
    },
    $$(selector) {
      return [...doc.querySelectorAll(selector)];
    },
    porNombre(nombre) {
      return doc.getElementsByName(nombre)[0];
    },

    /** Escribe en un campo del formulario. */
    escribir(nombre, texto) {
      const campo = pag.porNombre(nombre);
      campo.value = texto;
      campo.dispatchEvent(new win.Event("input", { bubbles: true }));
      return campo;
    },

    /** Elige una opcion de un desplegable. */
    elegir(nombre, valor) {
      const select = pag.porNombre(nombre);
      select.value = valor;
      select.dispatchEvent(new win.Event("change", { bubbles: true }));
      return select;
    },

    /** Pulsa el radio de un rol. */
    rol(valor) {
      const radio = doc.querySelector(`input[name="rol"][value="${valor}"]`);
      radio.checked = true;
      radio.dispatchEvent(new win.Event("change", { bubbles: true }));
      return radio;
    },

    /** Pulsa un boton. */
    pulsar(boton) {
      boton.dispatchEvent(new win.Event("click", { bubbles: true }));
    },

    /** Manda un formulario y espera a que termine su manejador. */
    async enviar(idFormulario) {
      const formulario = doc.getElementById(idFormulario);
      formulario.dispatchEvent(
        new win.Event("submit", { bubbles: true, cancelable: true })
      );
      // Varios turnos: el manejador es async y encadena varias
      // promesas (api -> fetch -> json), y hay que dejarlas todas.
      await dosTurnos();
      await dosTurnos();
    },

    /** Lo que un formulario mando al servidor, ya convertido de JSON. */
    cuerpoEnviado(numeroLlamada = 0) {
      const opciones = pag.fetch.mock.calls[numeroLlamada][1];
      return JSON.parse(opciones.body);
    },

    /** La ruta a la que se llamo en la numeroLlamada. */
    rutaLlamada(numeroLlamada = 0) {
      return pag.fetch.mock.calls[numeroLlamada][0];
    },

    /** Una tecla, para probar el Escape del modal. */
    tecla(nombre) {
      doc.dispatchEvent(
        new win.KeyboardEvent("keydown", { key: nombre, bubbles: true })
      );
    },

    tokenGuardado() {
      return win.localStorage.getItem("donando_token");
    },

    cerrar() {
      marco.remove();
    },
  };

  return pag;
}

/**
 * Abre index.html con SOLO comun.js, sin el script de la pagina.
 *
 * Sirve para probar las funciones de comun.js solas: sin login.js
 * cargado, la pagina no hace ninguna llamada a la API al abrirse y
 * las pruebas no se mezclan con el guardado automatico de sesion.
 */
function abrirComun(opciones = {}) {
  return abrirPagina({
    plantilla: "index.html",
    scripts: ["comun.js"],
    ...opciones,
  });
}

/** Abre index.html: registro e inicio de sesion. */
function abrirRegistro(opciones = {}) {
  return abrirPagina({
    plantilla: "index.html",
    scripts: ["comun.js", "login.js"],
    ...opciones,
  });
}

/** Abre inicio.html: listado de caridades y modal. */
function abrirCaridades(opciones = {}) {
  return abrirPagina({
    plantilla: "inicio.html",
    scripts: ["comun.js", "caridades.js"],
    ...opciones,
  });
}

/** Deja correr las promesas pendientes del script. */
function dosTurnos() {
  return new Promise((resolver) => setTimeout(resolver, 0));
}

/** Una caridad con TODOS los campos, como la devuelve la API. */
const CARIDAD_COMPLETA = {
  id: 1,
  nombre: "Fundacion Ayuda a Ninos",
  causa: "Ninos con cancer",
  ubicacion: "Torreon, Coahuila",
  info_extra: "Ayudamos a 300 ninos con tratamientos y medicamentos.",
  cuenta_numero: "123-456-7890",
  cuenta_titular: "Fundacion Ayuda a Ninos",
  cuenta_banco: "BBVA",
};

/** Varias caridades, para probar el listado. */
const CARIDADES = [
  CARIDAD_COMPLETA,
  {
    id: 2,
    nombre: "Hogares de la Esperanza",
    causa: "Adulto mayor abandonado",
    ubicacion: "Gomez, Durango",
    info_extra: "Alojamos a 120 adultos mayores.",
    cuenta_numero: "987-654-3210",
    cuenta_titular: "Asociacion Hogares de la Esperanza",
    cuenta_banco: "Nu",
  },
  {
    id: 3,
    nombre: "Manos que Resucitan",
    causa: "Desastres naturales",
    ubicacion: "Lerdo, Durango",
    info_extra: "",
    cuenta_numero: "555-123-4567",
    cuenta_titular: "Fundacion Manos que Resucitan",
    cuenta_banco: "Banregio",
  },
];

/** Como responde /api/yo. */
function yo(rol = "donante", nombre = "Ana") {
  return {
    status: 200,
    cuerpo: {
      id: 9,
      rol,
      nombre,
      correo: nombre.toLowerCase() + "@correo.com",
      creado_en: "2026-01-01T00:00:00",
    },
  };
}

/** Error de validacion como lo manda la API (422). */
function error422(campos) {
  return {
    status: 422,
    cuerpo: {
      detail: campos.map((campo) => ({
        type: "missing",
        loc: ["body", campo],
        msg: "Field required",
      })),
    },
  };
}

module.exports = {
  leerScript,
  leerPlantilla,
  respuestaFalsa,
  crearFetch,
  abrirPagina,
  abrirComun,
  abrirRegistro,
  abrirCaridades,
  dosTurnos,
  CARIDAD_COMPLETA,
  CARIDADES,
  yo,
  error422,
};
