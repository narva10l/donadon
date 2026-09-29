/* ==========================================================
   Pruebas de login.js: pestanas, campos por rol, registro y acceso.
   ========================================================== */

const { abrirRegistro, dosTurnos } = require("./ayudas");

/** Llena lo minimo para poder mandar el registro de un donante. */
function llenarDonante(pag) {
  pag.escribir("nombre", "Ana");
  pag.escribir("apellido", "Lopez");
  pag.escribir("correo", "ana@correo.com");
  pag.escribir("password", "secreta123");
}

/** Llena lo minimo para poder mandar el registro de una caridad. */
function llenarCaridad(pag) {
  pag.escribir("nombre", "Fundacion Ayuda");
  pag.escribir("correo", "ayuda@correo.com");
  pag.escribir("password", "secreta123");
  pag.escribir("causa", "Ninos con cancer");
  pag.elegir("ubicacion", "Torreon, Coahuila");
  pag.escribir("info_extra", "Ayudamos a 300 ninos.");
  pag.escribir("cuenta_numero", "123-456-7890");
  pag.escribir("cuenta_titular", "Fundacion Ayuda");
  pag.elegir("cuenta_banco", "BBVA");
}

/** Una respuesta de registro exitosa, con su token. */
const REGISTRO_OK = { status: 200, cuerpo: { access_token: "token-nuevo" } };

// ==================================================================
//  Las pestanas
// ==================================================================
describe("las pestanas", () => {
  test("al abrir se ve el formulario de crear cuenta", () => {
    const pag = abrirRegistro();

    expect(pag.$("#form-registro").classList.contains("oculto")).toBe(false);
    expect(pag.$("#form-login").classList.contains("oculto")).toBe(true);
  });

  test("al abrir, la pestana de crear cuenta es la activa", () => {
    const pag = abrirRegistro();

    const activas = pag.$$(".pestana.activa");

    expect(activas).toHaveLength(1);
    expect(activas[0].dataset.panel).toBe("registro");
  });

  test("al pulsar 'Iniciar sesion' se muestra ese formulario", () => {
    const pag = abrirRegistro();

    pag.pulsar(pag.$('.pestana[data-panel="login"]'));

    expect(pag.$("#form-login").classList.contains("oculto")).toBe(false);
    expect(pag.$("#form-registro").classList.contains("oculto")).toBe(true);
  });

  test("la pestana pulsada queda como la activa", () => {
    const pag = abrirRegistro();

    pag.pulsar(pag.$('.pestana[data-panel="login"]'));

    expect(pag.$('.pestana[data-panel="login"]').classList.contains("activa")).toBe(true);
    expect(pag.$('.pestana[data-panel="registro"]').classList.contains("activa")).toBe(false);
  });

  test("se puede volver a la pestana de crear cuenta", () => {
    const pag = abrirRegistro();
    pag.pulsar(pag.$('.pestana[data-panel="login"]'));

    pag.pulsar(pag.$('.pestana[data-panel="registro"]'));

    expect(pag.$("#form-registro").classList.contains("oculto")).toBe(false);
    expect(pag.$("#form-login").classList.contains("oculto")).toBe(true);
  });

  test("cambiar de pestana borra el mensaje de error", () => {
    const pag = abrirRegistro();
    pag.win.mostrarMensaje("Algo fallo");

    pag.pulsar(pag.$('.pestana[data-panel="login"]'));

    expect(pag.$("#mensaje").textContent).toBe("");
  });

  test("cambiar de pestana vacia lo que ya habías escrito", () => {
    const pag = abrirRegistro();
    pag.escribir("nombre", "Ana");

    pag.pulsar(pag.$('.pestana[data-panel="login"]'));

    expect(pag.porNombre("nombre").value).toBe("");
  });
});

// ==================================================================
//  Los campos que dependen del rol
// ==================================================================
describe("los campos que dependen del rol", () => {
  test("por defecto se es donante: aparece el apellido", () => {
    const pag = abrirRegistro();

    expect(pag.$("#bloque-apellido").classList.contains("oculto")).toBe(false);
    expect(pag.$("#bloque-caridad").classList.contains("oculto")).toBe(true);
  });

  test("al elegir caridad aparece su bloque y se va el apellido", () => {
    const pag = abrirRegistro();

    pag.rol("caridad");

    expect(pag.$("#bloque-caridad").classList.contains("oculto")).toBe(false);
    expect(pag.$("#bloque-apellido").classList.contains("oculto")).toBe(true);
  });

  test("el apellido es obligatorio para donante", () => {
    const pag = abrirRegistro();

    expect(pag.porNombre("apellido").required).toBe(true);
  });

  test("el apellido deja de ser obligatorio para caridad", () => {
    const pag = abrirRegistro();

    pag.rol("caridad");

    expect(pag.porNombre("apellido").required).toBe(false);
  });

  test("para donante los campos de caridad no son obligatorios", () => {
    const pag = abrirRegistro();

    ["causa", "ubicacion", "cuenta_numero", "cuenta_titular", "cuenta_banco"].forEach(
      (campo) => {
        expect(pag.porNombre(campo).required).toBe(false);
      }
    );
  });

  test("para caridad los campos de caridad si son obligatorios", () => {
    const pag = abrirRegistro();

    pag.rol("caridad");

    ["causa", "ubicacion", "cuenta_numero", "cuenta_titular", "cuenta_banco"].forEach(
      (campo) => {
        expect(pag.porNombre(campo).required).toBe(true);
      }
    );
  });

  test("el nombre y el correo son obligatorios para los dos roles", () => {
    const pag = abrirRegistro();

    expect(pag.porNombre("nombre").required).toBe(true);
    expect(pag.porNombre("correo").required).toBe(true);

    pag.rol("caridad");

    expect(pag.porNombre("nombre").required).toBe(true);
    expect(pag.porNombre("correo").required).toBe(true);
  });

  test("cambiar de rol borra el mensaje", () => {
    const pag = abrirRegistro();
    pag.win.mostrarMensaje("Algo fallo");

    pag.rol("caridad");

    expect(pag.$("#mensaje").textContent).toBe("");
  });

  test("se puede volver a donante y los campos cambian otra vez", () => {
    const pag = abrirRegistro();
    pag.rol("caridad");

    pag.rol("donante");

    expect(pag.$("#bloque-apellido").classList.contains("oculto")).toBe(false);
    expect(pag.porNombre("apellido").required).toBe(true);
    expect(pag.porNombre("causa").required).toBe(false);
  });
});

// ==================================================================
//  Registrar un donante
// ==================================================================
describe("registrar un donante", () => {
  test("manda a /api/registro", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.rutaLlamada()).toBe("/api/registro");
  });

  test("manda los datos del donante", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.cuerpoEnviado()).toEqual({
      rol: "donante",
      nombre: "Ana",
      correo: "ana@correo.com",
      password: "secreta123",
      apellido: "Lopez",
    });
  });

  test("no manda ningun dato de caridad", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    const enviado = pag.cuerpoEnviado();
    expect(enviado.causa).toBeUndefined();
    expect(enviado.cuenta_banco).toBeUndefined();
  });

  test("quita los espacios sobrantes de los textos", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    pag.escribir("nombre", "   Ana   ");
    pag.escribir("apellido", "  Lopez  ");
    pag.escribir("correo", "  ana@correo.com  ");
    pag.escribir("password", "secreta123");

    await pag.enviar("form-registro");

    expect(pag.cuerpoEnviado()).toMatchObject({
      nombre: "Ana",
      apellido: "Lopez",
      correo: "ana@correo.com",
    });
  });

  test("la contrasena NO se recorta: los espacios cuentan", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    llenarDonante(pag);
    pag.escribir("password", "  con espacios  ");

    await pag.enviar("form-registro");

    expect(pag.cuerpoEnviado().password).toBe("  con espacios  ");
  });

  test("guarda el token y se va al listado", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.tokenGuardado()).toBe("token-nuevo");
    expect(pag.destinos).toEqual(["/inicio"]);
  });
});

// ==================================================================
//  Registrar una caridad
// ==================================================================
describe("registrar una caridad", () => {
  test("manda todos los datos de la caridad", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    pag.rol("caridad");
    llenarCaridad(pag);

    await pag.enviar("form-registro");

    expect(pag.cuerpoEnviado()).toEqual({
      rol: "caridad",
      nombre: "Fundacion Ayuda",
      correo: "ayuda@correo.com",
      password: "secreta123",
      causa: "Ninos con cancer",
      ubicacion: "Torreon, Coahuila",
      info_extra: "Ayudamos a 300 ninos.",
      cuenta_numero: "123-456-7890",
      cuenta_titular: "Fundacion Ayuda",
      cuenta_banco: "BBVA",
    });
  });

  test("no manda el apellido, que es de donante", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    pag.rol("caridad");
    llenarCaridad(pag);

    await pag.enviar("form-registro");

    expect(pag.cuerpoEnviado().apellido).toBeUndefined();
  });

  test("la informacion extra puede ir vacia", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    pag.rol("caridad");
    llenarCaridad(pag);
    pag.escribir("info_extra", "");

    await pag.enviar("form-registro");

    expect(pag.cuerpoEnviado().info_extra).toBe("");
  });

  test("las tres ciudades del desplegable se pueden elegir", async () => {
    const pag = abrirRegistro({ respuestas: REGISTRO_OK });
    pag.rol("caridad");

    const opciones = pag
      .porNombre("ubicacion")
      .querySelectorAll("option")
      .values();

    expect([...opciones].map((o) => o.value)).toEqual([
      "",
      "Torreon, Coahuila",
      "Gomez, Durango",
      "Lerdo, Durango",
    ]);
  });
});

// ==================================================================
//  Cuando el registro falla
// ==================================================================
describe("cuando el registro falla", () => {
  const FALLO = {
    status: 409,
    cuerpo: { detail: "Ya existe una cuenta con ese correo." },
  };

  test("muestra el mensaje que devuelve el servidor", async () => {
    const pag = abrirRegistro({ respuestas: FALLO });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.$("#mensaje").textContent).toBe("Ya existe una cuenta con ese correo.");
  });

  test("no guarda sesion ni se va a otra pagina", async () => {
    const pag = abrirRegistro({ respuestas: FALLO });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.tokenGuardado()).toBeNull();
    expect(pag.destinos).toEqual([]);
  });

  test("vuelve a habilitar el boton para poder reintentar", async () => {
    const pag = abrirRegistro({ respuestas: FALLO });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    const boton = pag.$('#form-registro button[type="submit"]');
    expect(boton.disabled).toBe(false);
    expect(boton.textContent).toBe("Crear mi cuenta");
  });

  test("marca en rojo los campos que le faltan a la API", async () => {
    const pag = abrirRegistro({
      respuestas: {
        status: 422,
        cuerpo: { detail: [{ loc: ["body", "apellido"], msg: "Field required" }] },
      },
    });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.porNombre("apellido").classList.contains("invalido")).toBe(true);
    expect(pag.porNombre("nombre").classList.contains("invalido")).toBe(false);
  });

  test("si el error es de una regla del rol, solo avisa sin marcar campos", async () => {
    const pag = abrirRegistro({
      respuestas: {
        status: 422,
        cuerpo: { detail: [{ loc: [], msg: "Value error, El apellido es obligatorio." }] },
      },
    });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.$("#mensaje").textContent).toBe("El apellido es obligatorio.");
    expect(pag.$$(".invalido")).toHaveLength(0);
  });

  test("un error del servidor tampoco rompe la pagina", async () => {
    const pag = abrirRegistro({ respuestas: { status: 500, cuerpo: {} } });
    llenarDonante(pag);

    await pag.enviar("form-registro");

    expect(pag.$("#mensaje").textContent).toBe("Ocurrio un error inesperado.");
  });
});

// ==================================================================
//  Iniciar sesion
// ==================================================================
describe("iniciar sesion", () => {
  const LOGIN_OK = { status: 200, cuerpo: { access_token: "token-de-vuelta" } };

  test("manda a /api/login con correo y contrasena", async () => {
    const pag = abrirRegistro({ respuestas: LOGIN_OK });
    pag.pulsar(pag.$('.pestana[data-panel="login"]'));
    pag.$("#form-login").elements["correo"].value = "ana@correo.com";
    pag.$("#form-login").elements["password"].value = "secreta123";

    await pag.enviar("form-login");

    expect(pag.rutaLlamada()).toBe("/api/login");
    expect(pag.cuerpoEnviado()).toEqual({
      correo: "ana@correo.com",
      password: "secreta123",
    });
  });

  test("la contrasena se manda tal cual, sin recortar", async () => {
    const pag = abrirRegistro({ respuestas: LOGIN_OK });
    pag.pulsar(pag.$('.pestana[data-panel="login"]'));
    pag.$("#form-login").elements["correo"].value = "  ana@correo.com  ";
    pag.$("#form-login").elements["password"].value = "  con espacios  ";

    await pag.enviar("form-login");

    expect(pag.cuerpoEnviado()).toEqual({
      correo: "ana@correo.com",
      password: "  con espacios  ",
    });
  });

  test("si sale bien, guarda el token y entra al listado", async () => {
    const pag = abrirRegistro({ respuestas: LOGIN_OK });
    pag.pulsar(pag.$('.pestana[data-panel="login"]'));
    pag.$("#form-login").elements["correo"].value = "ana@correo.com";
    pag.$("#form-login").elements["password"].value = "secreta123";

    await pag.enviar("form-login");

    expect(pag.tokenGuardado()).toBe("token-de-vuelta");
    expect(pag.destinos).toEqual(["/inicio"]);
  });

  test("si la contrasena esta mal, avisa y no entra", async () => {
    const pag = abrirRegistro({
      respuestas: { status: 401, cuerpo: { detail: "Correo o contrasena incorrectos." } },
    });
    pag.pulsar(pag.$('.pestana[data-panel="login"]'));
    pag.$("#form-login").elements["correo"].value = "ana@correo.com";
    pag.$("#form-login").elements["password"].value = "malaclave";

    await pag.enviar("form-login");

    expect(pag.$("#mensaje").textContent).toBe("Correo o contrasena incorrectos.");
    expect(pag.tokenGuardado()).toBeNull();
    expect(pag.destinos).toEqual([]);
  });

  test("despues de un fallo, el boton vuelve a estar disponible", async () => {
    const pag = abrirRegistro({
      respuestas: { status: 401, cuerpo: { detail: "Correo o contrasena incorrectos." } },
    });
    pag.pulsar(pag.$('.pestana[data-panel="login"]'));
    pag.$("#form-login").elements["correo"].value = "ana@correo.com";
    pag.$("#form-login").elements["password"].value = "malaclave";

    await pag.enviar("form-login");

    const boton = pag.$('#form-login button[type="submit"]');
    expect(boton.disabled).toBe(false);
    expect(boton.textContent).toBe("Entrar");
  });
});

// ==================================================================
//  Si el visitante ya tenia sesion
// ==================================================================
describe("si el visitante ya tenia sesion", () => {
  // Aqui no se manda ningun formulario: lo que se comprueba es lo que
  // la pagina hace sola al abrirse, asi que solo se espera a que
  // terminen sus llamadas.
  test("se salta el acceso y va directo al listado", async () => {
    const pag = abrirRegistro({
      token: "token-viejo",
      respuestas: {
        status: 200,
        cuerpo: { id: 1, rol: "donante", nombre: "Ana", correo: "ana@correo.com" },
      },
    });

    await dosTurnos();

    expect(pag.rutaLlamada()).toBe("/api/yo");
    expect(pag.destinos).toEqual(["/inicio"]);
  });

  test("si el token ya no vale, lo borra y deja entrar de nuevo", async () => {
    const pag = abrirRegistro({
      token: "token-vencido",
      respuestas: { status: 401, cuerpo: { detail: "Token invalido." } },
    });

    await dosTurnos();

    expect(pag.tokenGuardado()).toBeNull();
  });

  test("sin token, la pagina no pregunta nada al abrirse", async () => {
    const pag = abrirRegistro();

    await dosTurnos();

    expect(pag.fetch).not.toHaveBeenCalled();
  });
});
