/* ==========================================================
   Pagina 2: listado de caridades + detalle en modal
   ========================================================== */

// Sin token no hay nada que hacer aqui
if (!leerToken()) {
  navegar("/");
}

const rejilla = document.getElementById("rejilla");
const modal = document.getElementById("modal");
const campoCargando = document.getElementById("cargando");
const campoMensaje = document.getElementById("mensaje");

// ------------------------------------------------------------
// Cargar quien esta conectado
// ------------------------------------------------------------
api("/api/yo")
  .then((yo) => {
    document.getElementById("mi-nombre").textContent = yo.nombre;
    const rol = document.getElementById("mi-rol");
    rol.textContent = yo.rol;
    rol.title = yo.correo;
  })
  .catch(() => {});

// ------------------------------------------------------------
// Cargar las caridades
// ------------------------------------------------------------
api("/api/caridades")
  .then((caridades) => {
    campoCargando.classList.add("oculto");
    mostrarCaridades(caridades);
  })
  .catch((error) => {
    campoCargando.classList.add("oculto");
    campoMensaje.textContent = error.message;
    campoMensaje.className = "mensaje error";
  });

function mostrarCaridades(caridades) {
  rejilla.innerHTML = "";

  if (caridades.length === 0) {
    const vacio = document.createElement("div");
    vacio.className = "vacio";
    vacio.innerHTML =
      "<strong>Todavia no hay caridades registradas</strong>" +
      "Registrate como caridad para que la primera aparezca aqui.";
    rejilla.appendChild(vacio);
    return;
  }

  caridades.forEach((caridad) => {
    const tarjeta = document.createElement("button");
    tarjeta.type = "button";
    tarjeta.className = "tarjeta";
    tarjeta.innerHTML =
      `<h3 class="tarjeta-titulo"></h3>` +
      `<p class="tarjeta-subtitulo"></p>` +
      `<span class="tarjeta-pie">Ver informacion completa &rarr;</span>`;

    // textContent evita que un nombre con <script> se ejecute
    tarjeta.querySelector(".tarjeta-titulo").textContent = caridad.nombre;
    tarjeta.querySelector(".tarjeta-subtitulo").textContent = caridad.causa;

    tarjeta.addEventListener("click", () => abrirModal(caridad));
    rejilla.appendChild(tarjeta);
  });
}

// ------------------------------------------------------------
// Modal de detalle
// ------------------------------------------------------------
function abrirModal(caridad) {
  document.getElementById("modal-titulo").textContent = caridad.nombre;
  document.getElementById("modal-subtitulo").textContent = caridad.causa;

  document.getElementById("dato-causa").textContent = caridad.causa;
  document.getElementById("dato-ubicacion").textContent = caridad.ubicacion;
  document.getElementById("dato-info").textContent =
    caridad.info_extra && caridad.info_extra.trim()
      ? caridad.info_extra
      : "Esta caridad no agrego informacion extra.";

  document.getElementById("dato-banco").textContent = caridad.cuenta_banco;
  document.getElementById("dato-cuenta").textContent = caridad.cuenta_numero;
  document.getElementById("dato-titular").textContent = caridad.cuenta_titular;

  modal.classList.remove("oculto");
  document.body.style.overflow = "hidden";
  modal.querySelector(".modal-cerrar").focus();
}

function cerrarModal() {
  modal.classList.add("oculto");
  document.body.style.overflow = "";
}

// Click en la X o en el fondo
modal.querySelectorAll("[data-cerrar]").forEach((el) => {
  el.addEventListener("click", cerrarModal);
});

// Tecla Escape
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && !modal.classList.contains("oculto")) {
    cerrarModal();
  }
});

// ------------------------------------------------------------
// Boton salir
// ------------------------------------------------------------
document.getElementById("btn-salir").addEventListener("click", () => {
  borrarToken();
  navegar("/");
});
