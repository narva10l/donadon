/* ==========================================================
   Pruebas de caridades.js: listado, modal y boton de salir.
   ========================================================== */

const { abrirCaridades, dosTurnos, CARIDADES, CARIDAD_COMPLETA, yo } = require("./ayudas");

/**
 * Abre el listado ya cargado: con sesion iniciada, /api/yo respondiendo
 * y la lista de caridades en pantalla.
 */
async function abrirListado(caridades = CARIDADES) {
  const pag = abrirCaridades({
    token: "token-de-prueba",
    respuestas: [yo("donante", "Ana"), { status: 200, cuerpo: caridades }],
  });

  await dosTurnos();
  return pag;
}

/** Pulsa la primera tarjeta de la rejilla. */
function tocarPrimeraTarjeta(pag) {
  pag.pulsar(pag.$(".tarjeta"));
}

// ==================================================================
//  La barra de arriba: quien esta conectado
// ==================================================================
describe("la barra de arriba", () => {
  test("muestra el nombre y el rol de quien entro", async () => {
    const pag = await abrirListado();

    expect(pag.$("#mi-nombre").textContent).toBe("Ana");
    expect(pag.$("#mi-rol").textContent).toBe("donante");
  });

  test("el correo queda escondido en el tooltip del rol", async () => {
    const pag = await abrirListado();

    expect(pag.$("#mi-rol").title).toBe("ana@correo.com");
  });

  test("si /api/yo falla, la pagina sigue funcionando", async () => {
    const pag = abrirCaridades({
      token: "token",
      respuestas: [
        { status: 500, cuerpo: {} },
        { status: 200, cuerpo: CARIDADES },
      ],
    });

    await dosTurnos();

    expect(pag.$(".tarjeta")).not.toBeNull();
  });
});

// ==================================================================
//  La rejilla de caridades
// ==================================================================
describe("la rejilla de caridades", () => {
  test("muestra una tarjeta por cada caridad", async () => {
    const pag = await abrirListado();

    expect(pag.$$(".tarjeta")).toHaveLength(3);
  });

  test("el nombre va en el titulo y la causa en el subtitulo", async () => {
    const pag = await abrirListado();

    const tarjeta = pag.$$(".tarjeta")[0];
    expect(tarjeta.querySelector(".tarjeta-titulo").textContent).toBe(CARIDAD_COMPLETA.nombre);
    expect(tarjeta.querySelector(".tarjeta-subtitulo").textContent).toBe(CARIDAD_COMPLETA.causa);
  });

  test("las tarjetas se guardan en el orden que las manda la API", async () => {
    const pag = await abrirListado();

    const titulos = pag.$$(".tarjeta").map((t) =>
      t.querySelector(".tarjeta-titulo").textContent
    );

    expect(titulos).toEqual(CARIDADES.map((c) => c.nombre));
  });

  test("el cartel de 'cargando' desaparece cuando ya llego la lista", async () => {
    const pag = await abrirListado();

    expect(pag.$("#cargando").classList.contains("oculto")).toBe(true);
  });

  test("un nombre con HTML se muestra como texto, no se ejecuta", async () => {
    const pag = await abrirListado([
      { ...CARIDAD_COMPLETA, nombre: "<img src=x onerror=alert(1)>" },
    ]);

    const tarjeta = pag.$(".tarjeta");
    expect(tarjeta.querySelector("img")).toBeNull();
    expect(tarjeta.querySelector(".tarjeta-titulo").textContent).toBe(
      "<img src=x onerror=alert(1)>"
    );
  });

  test("si no hay ninguna caridad, avisa en vez de mostrar una rejilla vacia", async () => {
    const pag = await abrirListado([]);

    expect(pag.$(".tarjeta")).toBeNull();
    expect(pag.$(".vacio")).not.toBeNull();
    expect(pag.$(".vacio").textContent).toContain("Todavia no hay caridades registradas");
  });

  test("si el servidor falla, lo dice arriba y no se traba", async () => {
    const pag = abrirCaridades({
      token: "token",
      respuestas: [yo(), { status: 500, cuerpo: {} }],
    });

    await dosTurnos();

    expect(pag.$("#mensaje").textContent).toBe("Ocurrio un error inesperado.");
    expect(pag.$("#mensaje").className).toBe("mensaje error");
    expect(pag.$("#cargando").classList.contains("oculto")).toBe(true);
  });
});

// ==================================================================
//  El modal de detalle
// ==================================================================
describe("el modal de detalle", () => {
  test("al abrir la pagina el modal esta cerrado", async () => {
    const pag = await abrirListado();

    expect(pag.$("#modal").classList.contains("oculto")).toBe(true);
  });

  test("tocar una tarjeta abre el modal", async () => {
    const pag = await abrirListado();

    tocarPrimeraTarjeta(pag);

    expect(pag.$("#modal").classList.contains("oculto")).toBe(false);
  });

  test("muestra el nombre y la causa de esa caridad", async () => {
    const pag = await abrirListado();

    tocarPrimeraTarjeta(pag);

    expect(pag.$("#modal-titulo").textContent).toBe(CARIDAD_COMPLETA.nombre);
    expect(pag.$("#modal-subtitulo").textContent).toBe(CARIDAD_COMPLETA.causa);
  });

  test("muestra causa, ubicacion e informacion extra", async () => {
    const pag = await abrirListado();

    tocarPrimeraTarjeta(pag);

    expect(pag.$("#dato-causa").textContent).toBe(CARIDAD_COMPLETA.causa);
    expect(pag.$("#dato-ubicacion").textContent).toBe(CARIDAD_COMPLETA.ubicacion);
    expect(pag.$("#dato-info").textContent).toBe(CARIDAD_COMPLETA.info_extra);
  });

  test("muestra los datos bancarios, que son solo informacion", async () => {
    const pag = await abrirListado();

    tocarPrimeraTarjeta(pag);

    expect(pag.$("#dato-banco").textContent).toBe(CARIDAD_COMPLETA.cuenta_banco);
    expect(pag.$("#dato-cuenta").textContent).toBe(CARIDAD_COMPLETA.cuenta_numero);
    expect(pag.$("#dato-titular").textContent).toBe(CARIDAD_COMPLETA.cuenta_titular);
  });

  test("cada tarjeta abre SU propia caridad", async () => {
    const pag = await abrirListado();

    pag.pulsar(pag.$$(".tarjeta")[1]);

    expect(pag.$("#modal-titulo").textContent).toBe(CARIDADES[1].nombre);
    expect(pag.$("#dato-banco").textContent).toBe(CARIDADES[1].cuenta_banco);
  });

  test("si no hay info extra, pone un texto en su lugar", async () => {
    const pag = await abrirListado();

    pag.pulsar(pag.$$(".tarjeta")[2]);

    expect(pag.$("#dato-info").textContent).toBe(
      "Esta caridad no agrego informacion extra."
    );
  });

  test("la info extra que solo tiene espacios tambien cuenta como vacia", async () => {
    const pag = await abrirListado([{ ...CARIDAD_COMPLETA, info_extra: "     " }]);

    tocarPrimeraTarjeta(pag);

    expect(pag.$("#dato-info").textContent).toBe(
      "Esta caridad no agrego informacion extra."
    );
  });

  test("al abrirlo se bloquea el fondo para que no se desplace", async () => {
    const pag = await abrirListado();

    tocarPrimeraTarjeta(pag);

    expect(pag.doc.body.style.overflow).toBe("hidden");
  });

  test("el foco pasa al boton de cerrar, para poder teclado", async () => {
    const pag = await abrirListado();

    tocarPrimeraTarjeta(pag);

    expect(pag.doc.activeElement).toBe(pag.$(".modal-cerrar"));
  });
});

// ==================================================================
//  Cerrar el modal
// ==================================================================
describe("cerrar el modal", () => {
  /** Deja el modal abierto y devuelve la pagina. */
  async function conModalAbierto() {
    const pag = await abrirListado();
    tocarPrimeraTarjeta(pag);
    return pag;
  }

  test("la X lo cierra", async () => {
    const pag = await conModalAbierto();

    pag.pulsar(pag.$(".modal-cerrar"));

    expect(pag.$("#modal").classList.contains("oculto")).toBe(true);
  });

  test("tocar el fondo oscuro tambien lo cierra", async () => {
    const pag = await conModalAbierto();

    pag.pulsar(pag.$(".modal-fondo"));

    expect(pag.$("#modal").classList.contains("oculto")).toBe(true);
  });

  test("cerrar devuelve el fondo a su estado normal", async () => {
    const pag = await conModalAbierto();

    pag.pulsar(pag.$(".modal-cerrar"));

    expect(pag.doc.body.style.overflow).toBe("");
  });

  test("la tecla Escape lo cierra", async () => {
    const pag = await conModalAbierto();

    pag.tecla("Escape");

    expect(pag.$("#modal").classList.contains("oculto")).toBe(true);
  });

  test("cualquier otra tecla no lo cierra", async () => {
    const pag = await conModalAbierto();

    pag.tecla("a");

    expect(pag.$("#modal").classList.contains("oculto")).toBe(false);
  });

  test("se puede cerrar y volver a abrir", async () => {
    const pag = await conModalAbierto();
    pag.pulsar(pag.$(".modal-cerrar"));

    tocarPrimeraTarjeta(pag);

    expect(pag.$("#modal").classList.contains("oculto")).toBe(false);
  });
});

// ==================================================================
//  Entrar y salir
// ==================================================================
describe("entrar y salir", () => {
  test("sin token no se puede ver el listado: manda a la portada", () => {
    const pag = abrirCaridades();

    expect(pag.destinos).toEqual(["/"]);
  });

  test("el boton Salir borra la sesion y vuelve a la portada", async () => {
    const pag = await abrirListado();

    pag.pulsar(pag.$("#btn-salir"));

    expect(pag.tokenGuardado()).toBeNull();
    expect(pag.destinos).toEqual(["/"]);
  });
});
