/* ==========================================================
   Pagina 1: registro e inicio de sesion
   ========================================================== */

// Si ya hay sesion, no tiene sentido quedarse aqui
if (leerToken()) {
  api("/api/yo")
    .then(() => navegar("/inicio"))
    .catch(() => borrarToken());
}

const formRegistro = document.getElementById("form-registro");
const formLogin = document.getElementById("form-login");
const bloqueApellido = document.getElementById("bloque-apellido");
const bloqueCaridad = document.getElementById("bloque-caridad");

// ------------------------------------------------------------
// Pestanas
// ------------------------------------------------------------
document.querySelectorAll(".pestana").forEach((pestana) => {
  pestana.addEventListener("click", () => {
    document.querySelectorAll(".pestana").forEach((p) => p.classList.remove("activa"));
    pestana.classList.add("activa");

    const objetivo = pestana.dataset.panel;
    formRegistro.classList.toggle("oculto", objetivo !== "registro");
    formLogin.classList.toggle("oculto", objetivo !== "login");

    limpiarMensaje();
    formRegistro.reset();
    aplicarRol();
  });
});

// ------------------------------------------------------------
// Mostrar / ocultar campos segun el rol.
// Ademas se activan/desactivan con `required` para que el propio
// navegador avise de lo que falta antes de llamar a la API.
// (Si un campo esta oculto y es required, el navegador nunca
//  deja enviar el formulario).
// ------------------------------------------------------------
const CAMPOS_DONANTE = ["apellido"];
const CAMPOS_CARIDAD = [
  "causa",
  "ubicacion",
  "cuenta_numero",
  "cuenta_titular",
  "cuenta_banco",
];

function aplicarRol() {
  const rol = formRegistro.elements["rol"].value;
  const esCaridad = rol === "caridad";

  bloqueCaridad.classList.toggle("oculto", !esCaridad);
  bloqueApellido.classList.toggle("oculto", esCaridad);

  CAMPOS_DONANTE.forEach((n) => {
    formRegistro.elements[n].required = !esCaridad;
  });
  CAMPOS_CARIDAD.forEach((n) => {
    formRegistro.elements[n].required = esCaridad;
  });
}

formRegistro.querySelectorAll('input[name="rol"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    aplicarRol();
    limpiarMensaje();
  });
});

aplicarRol();

// ------------------------------------------------------------
// Registro
// ------------------------------------------------------------
formRegistro.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarMensaje();

  const datos = {
    rol: valor(formRegistro, "rol"),
    nombre: valor(formRegistro, "nombre"),
    correo: valor(formRegistro, "correo"),
    password: formRegistro.elements["password"].value,
  };

  if (datos.rol === "donante") {
    datos.apellido = valor(formRegistro, "apellido");
  } else {
    datos.causa = valor(formRegistro, "causa");
    datos.ubicacion = valor(formRegistro, "ubicacion");
    datos.info_extra = valor(formRegistro, "info_extra");
    datos.cuenta_numero = valor(formRegistro, "cuenta_numero");
    datos.cuenta_titular = valor(formRegistro, "cuenta_titular");
    datos.cuenta_banco = valor(formRegistro, "cuenta_banco");
  }

  const boton = formRegistro.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = "Creando cuenta...";

  try {
    const respuesta = await api("/api/registro", { method: "POST", body: datos });
    guardarToken(respuesta.access_token);
    navegar("/inicio");
  } catch (error) {
    if (error.campos && error.campos.length) marcarInvalidos(formRegistro, error.campos);
    mostrarMensaje(error.message);
    boton.disabled = false;
    boton.textContent = "Crear mi cuenta";
  }
});

// ------------------------------------------------------------
// Iniciar sesion
// ------------------------------------------------------------
formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarMensaje();

  const boton = formLogin.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = "Entrando...";

  try {
    const respuesta = await api("/api/login", {
      method: "POST",
      body: {
        correo: valor(formLogin, "correo"),
        password: formLogin.elements["password"].value,
      },
    });
    guardarToken(respuesta.access_token);
    navegar("/inicio");
  } catch (error) {
    mostrarMensaje(error.message);
    boton.disabled = false;
    boton.textContent = "Entrar";
  }
});
