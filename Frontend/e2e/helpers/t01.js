// Utilidades de la tanda T01 (registro, navegación y perfil).
const { expect } = require('@playwright/test');
const { irAlLogin, abrirMenu, CLAVE } = require('../helpers');

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
    // El registro cuenta para el cupo de /signup del servidor: se espera el turno antes de enviarlo.
    await sesion.esperarCupo();
}

const registrate = (page) => page.getByText('Registrate', { exact: true }).locator('visible=true').last();

/** Campo por su placeholder, solo el que se ve (las pantallas anteriores siguen montadas debajo). */
const ph = (page, texto) => page.getByPlaceholder(texto).locator('visible=true').last();

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
 * La sesión de cada usuario la guarda y comparte helpers/sesion.js (cupo de ingresos, reintentos y estado en disco).
 */
const sesion = require('./sesion');

/** Abre una pestaña nueva con la sesión del usuario ya iniciada (misma idea que `abrirComoUsuario`). */
const abrirSesion = (browser, email) => sesion.abrirComo(browser, email);

module.exports.abrirSesion = abrirSesion;

/** Inicia sesión por la interfaz; si el servidor limita los intentos, espera y reintenta. */
async function iniciarSesionReintentando(page, email) {
    for (let intento = 1; intento <= 6; intento++) {
        await irAlLogin(page);
        await page.getByPlaceholder('Email').fill(email);
        await page.getByPlaceholder('Contraseña').fill(CLAVE);
        await sesion.esperarCupo();
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
