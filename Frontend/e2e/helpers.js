// Utilidades compartidas por los tests end-to-end.
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const CLAVE = 'Eurekapp1!';

const USUARIOS = {
    usuario: 'julia@mail.com',
    empleado: 'emp1.utn@eurekapp.com',
    dueno: 'owner.utn@eurekapp.com',
    encargado: 'encargado.utn@eurekapp.com',
    admin: 'soporte.eurekapp@gmail.com',
};

// Cuentas del carril paralelo (organizaciones 3 a 6 y usuarios que no usa el carril serie).
const USUARIOS_PARALELO = {
    usuarioValeria: 'valeria@mail.com',
    usuarioPedro: 'pedro@mail.com',
    usuarioMicaela: 'micaela@mail.com',
    empleadoAero: 'emp1.aero@eurekapp.com',
    empleadoPatio: 'emp1.patio@eurekapp.com',
    empleadoUnc: 'emp1.unc@eurekapp.com',
    empleadoDino: 'emp1.dino@eurekapp.com',
    duenoPatio: 'owner.patio@eurekapp.com',
    duenoUnc: 'owner.unc@eurekapp.com',
    duenoDino: 'owner.dino@eurekapp.com',
};

/** Un caso de la planilla dentro de un test: paso con título "caso NNN: descripción". */
const caso = (numero, descripcion, fn) => test.step(`caso ${String(numero).padStart(3, '0')}: ${descripcion}`, fn);

const foto = (nombre) => path.join(__dirname, 'fixtures', nombre);

/** Nombre único por corrida para que los tests que modifican estado no choquen entre sí. */
const nombreUnico = (prefijo) => `${prefijo} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/** Una foto válida que supera `mb` megabytes: la foto del seed con relleno al final (el decodificador lo ignora). */
function fotoPesada(mb) {
    const base = fs.readFileSync(foto('cargador_seed.jpg'));
    return Buffer.concat([base, Buffer.alloc(Math.ceil(mb * 1024 * 1024))]);
}

/** Entra desde la portada hasta la pantalla de inicio de sesión. */
async function irAlLogin(page) {
    await page.goto('/');
    await page.getByText('Iniciar sesión', { exact: true }).click();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
}

async function completarYEnviarLogin(page, email, clave) {
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Contraseña').fill(clave);
    // El ingreso cuenta para el cupo de /login del servidor: se espera el turno antes de enviarlo.
    await require('./helpers/sesion').esperarCupo();
    await page.getByText('Iniciar sesión', { exact: true }).last().click();
}

/** Inicia sesión por la interfaz y espera a que se vea el menú lateral del usuario. */
async function iniciarSesion(page, email, clave = CLAVE) {
    await irAlLogin(page);
    await completarYEnviarLogin(page, email, clave);
    await expect(page.getByText('Logout')).toBeVisible();
}

/** Abre una pestaña nueva con la sesión de `email` ya iniciada y el menú disponible (ver helpers/sesion.js). */
function abrirComoUsuario(browser, email) {
    return require('./helpers/sesion').abrirComo(browser, email);
}

/** Elige un archivo en el selector de archivos que abre `accion`. */
async function elegirArchivo(page, accion, archivo) {
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), accion()]);
    await selector.setFiles(archivo);
}

/** Abre el menú lateral con el botón de hamburguesa del encabezado (no tiene texto ni etiqueta). */
async function abrirMenu(page) {
    // Con pantallas apiladas quedan botones de menú ocultos: se usa el visible.
    await page.locator('button:has(img[src*="toggle-drawer-icon"])').locator('visible=true').last().click();
    await expect(page.getByText('Logout')).toBeInViewport();
}

/** Va a una opción del menú lateral. */
async function irAlMenu(page, opcion) {
    await abrirMenu(page);
    await page.locator('a', { has: page.getByText(opcion, { exact: true }) }).click();
}

/** Recepta un objeto con foto y título como empleado de la organización. Devuelve el título. */
async function receptarObjeto(page, titulo) {
    await irAlMenu(page, 'Receptar un objeto');
    await page.getByPlaceholder('Escribe un título').fill(titulo);
    await page.locator('input[type="file"]').first().setInputFiles(foto('billetera.png'));
    await expect(page.getByText('Seleccionar foto')).toBeVisible();
    await page.getByText('Receptar objeto encontrado', { exact: true }).click();
    await expect(page.getByText('El objeto fue cargado al inventario con éxito.')).toBeVisible();
    await page.getByText('Cerrar', { exact: true }).click();
    return titulo;
}

/**
 * Cambia la fecha en la que "se perdió" el objeto a unos días atrás. Por defecto la búsqueda usa
 * hace 3 horas, y un objeto recién receptado puede quedar unos minutos antes de esa hora.
 */
async function perderlo(page, diasAtras) {
    const destino = new Date(Date.now() - diasAtras * 24 * 3600 * 1000);
    await page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/).first().click();
    const hoy = new Date();
    if (destino.getMonth() !== hoy.getMonth()) await page.getByRole('button', { name: 'Previous Month' }).click();
    const dia = String(destino.getDate()).padStart(3, '0');
    await page.locator(`.react-datepicker__day--${dia}:not(.react-datepicker__day--outside-month)`).click();
}

/** Abre la pantalla de búsqueda, elige la organización donde se perdió el objeto y la fecha de pérdida. */
async function abrirBusqueda(page, organizacion = 'UTN FRC') {
    await irAlMenu(page, 'Buscar un objeto');
    await expect(page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo')).toBeVisible();
    await page.locator('select').first().selectOption({ label: organizacion });
    await perderlo(page, 2);
}

/**
 * Lleva el listado visible hasta el final una vez (como una persona que baja con el dedo o la rueda).
 * Devuelve la altura total del listado después de bajar, para saber si cargó más páginas.
 */
async function bajarListado(page) {
    return page.evaluate(() => {
        const visible = (e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
        };
        const candidatos = [...document.querySelectorAll('div')].filter((e) => {
            const o = getComputedStyle(e).overflowY;
            return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight && visible(e);
        });
        if (candidatos.length === 0) return 0;
        // El listado del inventario es el desplazable visible más grande.
        const lista = candidatos.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        lista.scrollTop = lista.scrollHeight;
        return lista.scrollHeight;
    });
}

const MAX_BAJADAS = 40;

/**
 * Baja por el listado del inventario, cargando páginas, hasta que el título se vea.
 * Falla si llega al tope de bajadas o al final del listado sin encontrarlo.
 */
async function bajarHastaVer(page, titulo) {
    const objetivo = page.getByText(titulo, { exact: true }).locator('visible=true');
    let alturaPrevia = -1;
    let sinCambios = 0;
    for (let i = 0; i < MAX_BAJADAS; i++) {
        if (await objetivo.count() > 0) return;
        const altura = await bajarListado(page);
        await page.waitForTimeout(700);
        // Altura 0: todavía no hay listado desplazable (la primera página sigue cargando o es corta). No cuenta
        // como "listado completo"; si nunca aparece, el tope de bajadas corta igual.
        sinCambios = altura !== 0 && altura === alturaPrevia ? sinCambios + 1 : 0;
        alturaPrevia = altura;
        if (sinCambios >= 3) break;
    }
    await expect(objetivo, `el objeto "${titulo}" no apareció al recorrer el listado completo`).toHaveCount(1, { timeout: 5000 });
}

/** Baja por el listado hasta que ya no carga más páginas (el listado queda completo). */
async function cargarListadoCompleto(page) {
    let alturaPrevia = -1;
    let sinCambios = 0;
    for (let i = 0; i < MAX_BAJADAS && sinCambios < 3; i++) {
        const altura = await bajarListado(page);
        await page.waitForTimeout(700);
        sinCambios = altura === alturaPrevia ? sinCambios + 1 : 0;
        alturaPrevia = altura;
    }
    expect(sinCambios, 'el listado siguió creciendo al llegar al tope de bajadas').toBeGreaterThanOrEqual(3);
}

const URL_BACKEND = process.env.E2E_BACK_URL || 'http://localhost:8080';

/**
 * Registra, mientras la persona usa la app, los pedidos al servidor que salieron sin credencial
 * (salvo los de /auth, que no la llevan) y los que el servidor rechazó por sesión inválida (401).
 * Una pantalla que carga bien pero solo porque la app renovó la sesión después de un rechazo
 * también cuenta como falla: la credencial tiene que salir en el primer pedido.
 */
function vigilarPedidos(page) {
    const sinCredencial = [];
    const rechazados = [];
    page.on('request', (r) => {
        if (!r.url().startsWith(URL_BACKEND) || r.method() === 'OPTIONS' || r.url().includes('/auth/')) return;
        if (!r.headers()['authorization']) sinCredencial.push(`${r.method()} ${r.url()}`);
    });
    page.on('response', (r) => {
        if (r.url().startsWith(URL_BACKEND) && r.status() === 401) rechazados.push(`${r.request().method()} ${r.url()}`);
    });
    return {
        verificar() {
            expect(sinCredencial, 'pedidos al servidor sin credencial').toEqual([]);
            expect(rechazados, 'pedidos rechazados por sesión inválida').toEqual([]);
        },
    };
}

/** Espera la respuesta del servidor a un pedido que hace la app: `metodo` y un trozo de la ruta. */
function esperarRespuesta(page, metodo, ruta) {
    return page.waitForResponse((r) => r.request().method() === metodo && r.url().startsWith(URL_BACKEND) && r.url().includes(ruta));
}

module.exports = {
    CLAVE, USUARIOS, USUARIOS_PARALELO, caso, foto, nombreUnico, fotoPesada,
    irAlLogin, completarYEnviarLogin, iniciarSesion, abrirComoUsuario, elegirArchivo, abrirMenu, irAlMenu, receptarObjeto,
    bajarHastaVer, cargarListadoCompleto, perderlo, abrirBusqueda, vigilarPedidos, esperarRespuesta,
};
