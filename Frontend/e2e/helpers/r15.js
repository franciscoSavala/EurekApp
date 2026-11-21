// Utilidades de la tanda R15 (navegación por rol y Mi perfil).
const { expect } = require('@playwright/test');
const { abrirMenu } = require('../helpers');
const { enlaceMenu, entrarPorMenu, verificarPantalla, abrirMenuDesdeInicio } = require('./t01');

const VERSION = 'Versión de la app: 0.0.1';
const CONTACTO = 'Contacto: soporte.eurekapp@gmail.com';

/** Pie del menú: versión, contacto y Logout. */
async function verificarPie(page) {
    await expect.soft(page.getByText(VERSION, { exact: true }), 'versión de la app en el pie del menú').toBeVisible({ timeout: 3000 });
    await expect.soft(page.getByText(CONTACTO, { exact: true }), 'contacto en el pie del menú').toBeVisible({ timeout: 3000 });
    await expect.soft(page.getByText('Logout', { exact: true })).toBeVisible();
}

/** Las opciones están, se ven en ese orden (de arriba hacia abajo) y no sobra ninguna de las prohibidas. */
async function verificarMenu(page, opciones, ausentes = []) {
    const alturas = [];
    for (const texto of opciones) {
        const enlace = enlaceMenu(page, texto);
        await expect.soft(enlace, `opción "${texto}" del menú`).toBeVisible({ timeout: 3000 });
        const caja = (await enlace.isVisible()) ? await enlace.boundingBox() : null;
        alturas.push(caja ? caja.y : null);
    }
    const presentes = alturas.filter((y) => y !== null);
    expect.soft(presentes, `orden del menú: ${opciones.join(', ')}`).toEqual([...presentes].sort((a, b) => a - b));
    for (const texto of ausentes) {
        await expect.soft(enlaceMenu(page, texto), `"${texto}" no debería estar en el menú`).toBeHidden();
    }
    await verificarPie(page);
}

/** Que no aparezca ninguna de estas opciones en el menú abierto. */
async function verificarAusentes(page, ausentes) {
    for (const texto of ausentes) {
        await expect.soft(enlaceMenu(page, texto), `"${texto}" no debería estar en el menú`).toBeHidden();
    }
}

/** Abre el menú, presiona Logout y comprueba la portada con sus dos botones. */
async function cerrarSesionPorMenu(page) {
    await abrirMenuDesdeInicio(page);
    await page.getByText('Logout', { exact: true }).click();
    await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
    await expect.soft(page.getByText('Iniciar sesión', { exact: true }).locator('visible=true').first()).toBeVisible();
    await expect.soft(page.getByText('Registrate', { exact: true }).locator('visible=true').first()).toBeVisible();
}

/** Los tres campos de datos personales del perfil: nombre, apellido y email. */
const camposPerfil = (page) => page.locator('input:visible');

/** Entra a Mi perfil por el menú y verifica la pantalla y que muestre los datos del usuario. */
async function irAMiPerfil(page, email) {
    const entro = await entrarPorMenu(page, 'Mi perfil');
    expect(entro, 'la opción "Mi perfil" no está en el menú').toBe(true);
    await verificarPantalla(page, 'Mi perfil');
    await expect(page.getByText('Nombre:')).toBeVisible();
    if (email) await expect(camposPerfil(page).nth(2)).toHaveAttribute('placeholder', email);
}

/** Datos personales y tipo de usuario (y organización, si corresponde) de Mi perfil abierto. */
async function verificarDatosPerfil(page, tipo, conOrganizacion) {
    await expect.soft(page.getByText('Apellido:')).toBeVisible();
    await expect.soft(page.getByText('Email:')).toBeVisible();
    const nombre = await camposPerfil(page).nth(0).getAttribute('placeholder');
    const apellido = await camposPerfil(page).nth(1).getAttribute('placeholder');
    expect.soft((nombre || '').trim(), 'nombre del usuario').not.toBe('');
    expect.soft((apellido || '').trim(), 'apellido del usuario').not.toBe('');
    await expect.soft(page.getByText('Tipo de usuario:')).toBeVisible();
    await expect.soft(page.getByText(tipo, { exact: true }).locator('visible=true').first(), `tipo de usuario "${tipo}"`).toBeVisible();
    if (conOrganizacion) await expect.soft(page.getByText(/Organización:/).locator('visible=true').first()).toBeVisible();
    else await expect.soft(page.getByText(/Organización:/).locator('visible=true')).toHaveCount(0);
}

module.exports = { VERSION, CONTACTO, verificarPie, verificarMenu, verificarAusentes, cerrarSesionPorMenu, camposPerfil, irAMiPerfil, verificarDatosPerfil, abrirMenu };
