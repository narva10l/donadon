/* ==========================================================
   Pruebas de comun.js: token, mensajes y las llamadas a la API.
   ========================================================== */

const { abrirComun } = require("./ayudas");

/**
 * Abre index.html con solo comun.js.
 *
 * Se carga el HTML real porque hacen falta el formulario y la caja de
 * mensajes, pero NO login.js: si estuviera cargado, la pagina haria
 * una llamada a la API al abrirse y ensuciaria estas pruebas, que son
 * de una funcion suelta cada una.
 */
function comun() {
  return abrirComun();
}

/** Llama a una funcion global de comun.js dentro de su iframe. */
function invocar(pag, nombre, ...args) {
  return pag.win[nombre](...args);
}

// ==================================================================
//  El token
// ==================================================================
describe("el token", () => {
  test("al principio no hay sesion iniciada", () => {
    const pag = comun();

    expect(pag.tokenGuardado()).toBeNull();
  });

  test("guardarToken lo deja en localStorage", () => {
    const pag = comun();

    invocar(pag, "guardarToken", "abc123");

    expect(pag.tokenGuardado()).toBe("abc123");
  });

  test("leerToken devuelve lo que se guardo", () => {
    const pag = comun();

    invocar(pag, "guardarToken", "abc123");

    expect(invocar(pag, "leerToken")).toBe("abc123");
  });

  test("leerToken devuelve null si nunca se guardo nada", () => {
    const pag = comun();

    expect(invocar(pag, "leerToken")).toBeNull();
  });

  test("borrarToken cierra la sesion", () => {
    const pag = comun();
    invocar(pag, "guardarToken", "abc123");

    invocar(pag, "borrarToken");

    expect(pag.tokenGuardado()).toBeNull();
  });
});

// ==================================================================
//  Leer los campos del formulario
// ==================================================================
describe("valor()", () => {
  test("devuelve lo que hay escrito", () => {
    const pag = comun();

    pag.escribir("nombre", "Ana");

    expect(invocar(pag, "valor", pag.$("#form-registro"), "nombre")).toBe("Ana");
  });

  test("quita los espacios de los dos lados", () => {
    const pag = comun();

    pag.escribir("nombre", "   Ana   ");

    expect(invocar(pag, "valor", pag.$("#form-registro"), "nombre")).toBe("Ana");
  });

  test("si el campo no existe devuelve cadena vacia y no revienta", () => {
    const pag = comun();

    const resultado = invocar(pag, "valor", pag.$("#form-registro"), "no-existe");

    expect(resultado).toBe("");
  });
});

// ==================================================================
//  El mensaje de arriba del formulario
// ==================================================================
describe("mostrarMensaje()", () => {
  test("escribe el texto que le pasan", () => {
    const pag = comun();

    invocar(pag, "mostrarMensaje", "Correo o contrasena incorrectos.");

    expect(pag.$("#mensaje").textContent).toBe("Correo o contrasena incorrectos.");
  });

  test("lo marca como error", () => {
    const pag = comun();

    invocar(pag, "mostrarMensaje", "Algo fallo");

    expect(pag.$("#mensaje").className).toBe("mensaje error");
  });

  test("acepta otro tipo, como 'exito'", () => {
    const pag = comun();

    invocar(pag, "mostrarMensaje", "Listo", "exito");

    expect(pag.$("#mensaje").className).toBe("mensaje exito");
  });

  test("el texto se mete como texto, no como HTML", () => {
    const pag = comun();

    invocar(pag, "mostrarMensaje", "<img src=x onerror=alert(1)>");

    expect(pag.$("#mensaje").querySelector("img")).toBeNull();
    expect(pag.$("#mensaje").textContent).toBe("<img src=x onerror=alert(1)>");
  });

  test("limpiarMensaje lo borra y lo esconde", () => {
    const pag = comun();
    invocar(pag, "mostrarMensaje", "Algo fallo");

    invocar(pag, "limpiarMensaje");

    expect(pag.$("#mensaje").textContent).toBe("");
    expect(pag.$("#mensaje").className).toBe("mensaje oculto");
  });
});

// ==================================================================
//  Marcar los campos que faltan
// ==================================================================
describe("marcarInvalidos()", () => {
  test("marca en rojo el campo que menciona el texto", () => {
    const pag = comun();

    invocar(pag, "marcarInvalidos", pag.$("#form-registro"), ["apellido"]);

    expect(pag.porNombre("apellido").classList.contains("invalido")).toBe(true);
  });

  test("no marca los demas", () => {
    const pag = comun();

    invocar(pag, "marcarInvalidos", pag.$("#form-registro"), ["apellido"]);

    expect(pag.porNombre("nombre").classList.contains("invalido")).toBe(false);
  });

  test("si un texto no corresponde a nada, no falla", () => {
    const pag = comun();

    expect(() =>
      invocar(pag, "marcarInvalidos", pag.$("#form-registro"), ["inventado"])
    ).not.toThrow();
  });

  test("al volver a marcar, se limpian los marcas anteriores", () => {
    const pag = comun();
    invocar(pag, "marcarInvalidos", pag.$("#form-registro"), ["apellido"]);

    invocar(pag, "marcarInvalidos", pag.$("#form-registro"), ["correo"]);

    expect(pag.porNombre("apellido").classList.contains("invalido")).toBe(false);
    expect(pag.porNombre("correo").classList.contains("invalido")).toBe(true);
  });
});

// ==================================================================
//  api(): hablar con el servidor
// ==================================================================
describe("api()", () => {
  test("devuelve el JSON que responde el servidor", async () => {
    const pag = abrirComun({ respuestas: { status: 200, cuerpo: { ok: 1 } } });

    const resultado = await invocar(pag, "api", "/api/caridades");

    expect(resultado).toEqual({ ok: 1 });
  });

  test("manda el token en la cabecera Authorization", async () => {
    const pag = abrirComun({
      token: "mi-token",
      respuestas: { status: 200, cuerpo: {} },
    });

    await invocar(pag, "api", "/api/caridades");

    expect(pag.fetch).toHaveBeenCalledWith(
      "/api/caridades",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer mi-token" }),
      })
    );
  });

  test("sin sesion no manda cabecera Authorization", async () => {
    const pag = abrirComun({ respuestas: { status: 200, cuerpo: {} } });

    await invocar(pag, "api", "/api/caridades");

    const [, opciones] = pag.fetch.mock.calls[0];
    expect(opciones.headers.Authorization).toBeUndefined();
  });

  test("por defecto hace un GET", async () => {
    const pag = abrirComun({ respuestas: { status: 200, cuerpo: {} } });

    await invocar(pag, "api", "/api/caridades");

    expect(pag.fetch.mock.calls[0][1].method).toBe("GET");
  });

  test("un POST manda el cuerpo en JSON", async () => {
    const pag = abrirComun({ respuestas: { status: 200, cuerpo: {} } });

    await invocar(pag, "api", "/api/login", {
      method: "POST",
      body: { correo: "a@b.com", password: "123" },
    });

    const [, opciones] = pag.fetch.mock.calls[0];
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(opciones.body)).toEqual({ correo: "a@b.com", password: "123" });
  });

  // ----------------------------------------------------------------
  //  401: el token vencio o el usuario ya no existe
  // ----------------------------------------------------------------
  test("con un 401 borra el token y manda a la portada", async () => {
    const pag = abrirComun({
      token: "vencido",
      respuestas: { status: 401, cuerpo: { detail: "Token invalido." } },
    });

    await expect(invocar(pag, "api", "/api/caridades")).rejects.toThrow(
      "sesion vencida"
    );

    expect(pag.tokenGuardado()).toBeNull();
    expect(pag.destinos).toEqual(["/"]);
  });

  test("un 401 en el login NO manda a la portada", async () => {
    const pag = abrirComun({
      respuestas: { status: 401, cuerpo: { detail: "Correo o contrasena incorrectos." } },
    });

    await expect(
      invocar(pag, "api", "/api/login", { method: "POST", body: {} })
    ).rejects.toThrow("Correo o contrasena incorrectos.");

    expect(pag.destinos).toEqual([]);
  });

  test("un 401 en el registro tampoco manda a la portada", async () => {
    const pag = abrirComun({
      respuestas: { status: 401, cuerpo: { detail: "Ya existe una cuenta con ese correo." } },
    });

    await expect(
      invocar(pag, "api", "/api/registro", { method: "POST", body: {} })
    ).rejects.toThrow();

    expect(pag.destinos).toEqual([]);
  });

  // ----------------------------------------------------------------
  //  422: faltaron campos o vinieron mal
  // ----------------------------------------------------------------
  test("un 422 arma un error con el texto de la API", async () => {
    const pag = abrirComun({
      respuestas: {
        status: 422,
        cuerpo: { detail: [{ loc: ["body", "correo"], msg: "Field required" }] },
      },
    });

    await expect(invocar(pag, "api", "/api/registro")).rejects.toThrow(
      "correo: Field required"
    );
  });

  test("el error de 422 trae la lista de campos para marcarlos", async () => {
    const pag = abrirComun({
      respuestas: {
        status: 422,
        cuerpo: {
          detail: [
            { loc: ["body", "nombre"], msg: "Field required" },
            { loc: ["body", "correo"], msg: "Field required" },
          ],
        },
      },
    });

    let error = null;
    try {
      await invocar(pag, "api", "/api/registro");
    } catch (e) {
      error = e;
    }

    expect(error.campos).toEqual(["nombre", "correo"]);
  });

  test("quita el 'Value error,' que Pydantic pone adelante", async () => {
    const pag = abrirComun({
      respuestas: {
        status: 422,
        cuerpo: {
          detail: [
            {
              // loc vacio: es lo que manda Pydantic cuando el problema
              // depende del rol, no de un campo en concreto.
              loc: [],
              msg: "Value error, Para registrarte como caridad debes completar: causa",
            },
          ],
        },
      },
    });

    await expect(invocar(pag, "api", "/api/registro")).rejects.toThrow(
      "Para registrarte como caridad debes completar: causa"
    );
  });

  test("une varios errores con una barra vertical", async () => {
    const pag = abrirComun({
      respuestas: {
        status: 422,
        cuerpo: {
          detail: [
            { loc: ["body", "nombre"], msg: "Field required" },
            { loc: ["body", "correo"], msg: "Field required" },
          ],
        },
      },
    });

    let error = null;
    try {
      await invocar(pag, "api", "/api/registro");
    } catch (e) {
      error = e;
    }

    expect(error.message).toBe("nombre: Field required | correo: Field required");
  });

  test("una regla del rol no marca ningun campo, solo avisa", async () => {
    const pag = abrirComun({
      respuestas: {
        status: 422,
        cuerpo: { detail: [{ loc: [], msg: "Value error, El apellido es obligatorio." }] },
      },
    });

    let error = null;
    try {
      await invocar(pag, "api", "/api/registro");
    } catch (e) {
      error = e;
    }

    expect(error.campos).toEqual([]);
    expect(error.message).toBe("El apellido es obligatorio.");
  });

  // ----------------------------------------------------------------
  //  Otros errores
  // ----------------------------------------------------------------
  test("un 409 usa el detalle que manda la API", async () => {
    const pag = abrirComun({
      respuestas: {
        status: 409,
        cuerpo: { detail: "Ya existe una cuenta con ese correo." },
      },
    });

    await expect(invocar(pag, "api", "/api/registro")).rejects.toThrow(
      "Ya existe una cuenta con ese correo."
    );
  });

  test("un 500 sin detalle da un mensaje generico", async () => {
    const pag = abrirComun({ respuestas: { status: 500, cuerpo: {} } });

    await expect(invocar(pag, "api", "/api/caridades")).rejects.toThrow(
      "Ocurrio un error inesperado."
    );
  });
});
