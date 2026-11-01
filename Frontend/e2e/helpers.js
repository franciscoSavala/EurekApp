// Utilidades compartidas por los tests end-to-end.
const path = require('path');
const fs = require('fs');
const { expect } = require('@playwright/test');

const CLAVE = 'Eurekapp1!';

const USUARIOS = {
    usuario: 'julia@mail.com',
    empleado: 'emp1.utn@eurekapp.com',
    dueno: 'owner.utn@eurekapp.com',
    encargado: 'encargado.utn@eurekapp.com',
    admin: 'soporte.eurekapp@gmail.com',
};

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
    await page.getByText('Iniciar sesión', { exact: true }).last().click();
}

/** Inicia sesión por la interfaz y espera a que se vea el menú lateral del usuario. */
async function iniciarSesion(page, email, clave = CLAVE) {
    await irAlLogin(page);
    await completarYEnviarLogin(page, email, clave);
    await expect(page.getByText('Logout')).toBeVisible();
}

/*
 * Para no repetir el ingreso por pantalla en cada test, la primera vez que se pide un usuario se
 * inicia sesión por la interfaz y se guarda el estado del navegador; los tests siguientes abren
 * una pestaña nueva con ese estado. El cierre de sesión de la app es local, así que no lo invalida.
 */
const estadosDeSesion = new Map();

/** Abre una pestaña nueva con la sesión de `email` ya iniciada y el menú disponible. */
async function abrirComoUsuario(browser, email) {
    const opciones = { baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082', viewport: { width: 1280, height: 900 } };
    if (!estadosDeSesion.has(email)) {
        const contextoInicial = await browser.newContext(opciones);
        const paginaInicial = await contextoInicial.newPage();
        await iniciarSesion(paginaInicial, email);
        estadosDeSesion.set(email, await contextoInicial.storageState());
        await contextoInicial.close();
    }
    const context = await browser.newContext({ ...opciones, storageState: estadosDeSesion.get(email) });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    return { context, page };
}

/** Elige un archivo en el selector de archivos que abre `accion`. */
async function elegirArchivo(page, accion, archivo) {
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), accion()]);
    await selector.setFiles(archivo);
}

/** Abre el menú lateral con el botón de hamburguesa del encabezado (no tiene texto ni etiqueta). */
async function abrirMenu(page) {
    await page.locator('button:has(img[src*="toggle-drawer-icon"])').last().click();
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
    const objetivo = page.getByText(titulo, { exact: true }).filter({ visible: true });
    let alturaPrevia = -1;
    let sinCambios = 0;
    for (let i = 0; i < MAX_BAJADAS; i++) {
        if (await objetivo.count() > 0) return;
        const altura = await bajarListado(page);
        await page.waitForTimeout(700);
        sinCambios = altura === alturaPrevia ? sinCambios + 1 : 0;
        alturaPrevia = altura;
        if (sinCambios >= 3) break;
    }
    await expect(objetivo, `el objeto "${titulo}" no apareció al recorrer el listado completo`).toHaveCount(1, { timeout: 2000 });
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

module.exports = {
    CLAVE, USUARIOS, foto, nombreUnico, fotoPesada,
    irAlLogin, completarYEnviarLogin, iniciarSesion, abrirComoUsuario, elegirArchivo, abrirMenu, irAlMenu, receptarObjeto,
    bajarHastaVer, cargarListadoCompleto,
};
