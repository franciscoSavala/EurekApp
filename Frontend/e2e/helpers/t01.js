// Utilidades de la tanda T01 (registro, navegación y perfil).
const { expect } = require('@playwright/test');
const { irAlLogin, abrirMenu } = require('../helpers');

/** Email que no existe todavía: único por corrida. */
const emailUnico = (prefijo = 'e2e.t01') => `${prefijo}.${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}@mail.com`;

/** Va de la portada al login y de ahí a la pantalla de registro con el enlace del login. */
async function irARegistro(page) {
    await irAlLogin(page);
    await page.getByText('¿No tenés cuenta? Registrate').click();
    await expect(ph(page, 'Nombre')).toBeVisible();
}

/** Completa el formulario de registro. Un valor `null` deja el campo como está (vacío). */
async function completarRegistro(page, { nombre = 'Test', apellido = 'Tanda', email = emailUnico(), clave = 'Eurekapp1!' } = {}) {
    if (nombre !== null) await ph(page, 'Nombre').fill(nombre);
    if (apellido !== null) await ph(page, 'Apellido').fill(apellido);
    if (email !== null) await ph(page, 'Email').fill(email);
    if (clave !== null) await ph(page, 'Contraseña').fill(clave);
}

const registrate = (page) => page.getByText('Registrate', { exact: true }).filter({ visible: true }).last();

/** Campo por su placeholder, solo el que se ve (las pantallas anteriores siguen montadas debajo). */
const ph = (page, texto) => page.getByPlaceholder(texto).filter({ visible: true }).last();

/** Ruta web de la pantalla a la que lleva cada opción del menú lateral. */
const RUTAS = {
    'Buscar un objeto': 'FindObjectStackScreen',
    'Receptar un objeto': 'UploadObject',
    'Ver inventario': 'LostObjectReturnStackScreen',
    'Ver objetos devueltos': 'ReturnedObjectsStackScreen',
    'Logros': 'AchievementsStackScreen',
    'Mi perfil': 'ProfileStackScreen',
    'Alertas de fraude': 'FraudAlertsStackScreen',
    'Reportes': 'ReportsStackScreen',
    'Mi organización': 'OrganizationStackScreen',
};

/** Enlace del menú lateral con ese texto. */
const enlaceMenu = (page, texto) => page.locator('a', { has: page.getByText(texto, { exact: true }) });

/** Abre el menú desde la pantalla de inicio de la sesión (recarga para no arrastrar botones de pantallas anteriores). */
async function abrirMenuDesdeInicio(page) {
    await page.goto('/');
    await abrirMenu(page);
}

/**
 * Abre el menú y entra a la opción. Si la opción no está en el menú, deja el fallo anotado (soft)
 * y devuelve false para que el test siga con el resto.
 */
async function entrarPorMenu(page, opcion) {
    await abrirMenuDesdeInicio(page);
    const enlace = enlaceMenu(page, opcion);
    await expect.soft(enlace, `el menú debería tener "${opcion}"`).toBeVisible({ timeout: 3000 });
    if (!(await enlace.isVisible())) return false;
    await enlace.click();
    return true;
}

/** Verifica que la app quedó en la pantalla de la opción (por su ruta). */
async function verificarPantalla(page, opcion) {
    await expect(page).toHaveURL(new RegExp(`/${RUTAS[opcion]}`));
}

/** Verifica que el menú tenga cada opción y muestre versión, contacto y Logout. */
async function verificarOpcionesDelMenu(page, opciones) {
    for (const texto of opciones) {
        await expect.soft(enlaceMenu(page, texto), `opción "${texto}" del menú`).toBeVisible({ timeout: 3000 });
    }
    await expect.soft(page.getByText(/Versión de la app:/)).toBeVisible();
    await expect.soft(page.getByText(/Contacto:/)).toBeVisible();
    await expect.soft(page.getByText('Logout')).toBeVisible();
}

module.exports = {
    ph,
    emailUnico, irARegistro, completarRegistro, registrate,
    RUTAS, enlaceMenu, abrirMenuDesdeInicio, entrarPorMenu, verificarPantalla, verificarOpcionesDelMenu,
};

/*
 * El servidor limita los intentos de ingreso (429) y varios tests corren a la vez. Por eso la sesión
 * de cada usuario se inicia una sola vez por interfaz, con reintentos, y se guarda en disco unos
 * minutos para que la reutilicen los demás archivos y workers.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CLAVE } = require('../helpers');

const VIGENCIA_MS = 20 * 60 * 1000;
const OPCIONES_CONTEXTO = { baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082', viewport: { width: 1280, height: 900 } };
const archivoSesion = (email) => path.join(os.tmpdir(), `e2e-t01-${email.replace(/[^a-z0-9]/gi, '_')}.json`);

async function iniciarYGuardarSesion(browser, email) {
    for (let intento = 1; intento <= 6; intento++) {
        const contexto = await browser.newContext(OPCIONES_CONTEXTO);
        const pagina = await contexto.newPage();
        try {
            await irAlLogin(pagina);
            await pagina.getByPlaceholder('Email').fill(email);
            await pagina.getByPlaceholder('Contraseña').fill(CLAVE);
            await pagina.getByText('Iniciar sesión', { exact: true }).last().click();
            await expect(pagina.getByText('Logout')).toBeVisible({ timeout: 20_000 });
            const estado = await contexto.storageState();
            fs.writeFileSync(archivoSesion(email), JSON.stringify(estado));
            await contexto.close();
            return estado;
        } catch (e) {
            await contexto.close();
            if (intento === 6) throw e;
            await new Promise((r) => setTimeout(r, 4000 * intento));
        }
    }
}

/** Abre una pestaña nueva con la sesión del usuario ya iniciada (misma idea que `abrirComoUsuario`, tolerante al límite de ingresos). */
async function abrirSesion(browser, email) {
    const archivo = archivoSesion(email);
    let estado = null;
    try {
        if (Date.now() - fs.statSync(archivo).mtimeMs < VIGENCIA_MS) estado = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    } catch (e) { /* sin sesión guardada */ }
    if (!estado) estado = await iniciarYGuardarSesion(browser, email);
    const context = await browser.newContext({ ...OPCIONES_CONTEXTO, storageState: estado });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    return { context, page };
}

module.exports.abrirSesion = abrirSesion;

/** Inicia sesión por la interfaz; si el servidor limita los intentos, espera y reintenta. */
async function iniciarSesionReintentando(page, email) {
    for (let intento = 1; intento <= 6; intento++) {
        await irAlLogin(page);
        await page.getByPlaceholder('Email').fill(email);
        await page.getByPlaceholder('Contraseña').fill(CLAVE);
        await page.getByText('Iniciar sesión', { exact: true }).last().click();
        try {
            await expect(page.getByText('Logout')).toBeVisible({ timeout: 20_000 });
            return;
        } catch (e) {
            if (intento === 6) throw e;
            await page.waitForTimeout(4000 * intento);
        }
    }
}

module.exports.iniciarSesionReintentando = iniciarSesionReintentando;
