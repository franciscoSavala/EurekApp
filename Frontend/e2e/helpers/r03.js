// Utilidades de la tanda R03 (recepción, inventario, detalle y opinión sobre la app).
const { expect } = require('@playwright/test');
const { irAlMenu, esperarRespuesta } = require('../helpers');

const CON_IMAGEN = "xpath=ancestor::div[.//*[contains(@style,'background-image')]][1]";

/** Recarga la app (para no arrastrar pantallas apiladas) y entra a la opción del menú. */
async function irPorMenu(page, opcion) {
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    await irAlMenu(page, opcion);
}

/** Las tarjetas visibles del inventario (una por objeto), a partir de su botón Devolver. */
const tarjetas = (page) => page.getByText('Devolver', { exact: true }).locator('visible=true').locator(CON_IMAGEN);

/** La tarjeta del objeto con ese título. */
const tarjetaDe = (page, titulo) => page.getByText(titulo, { exact: true }).locator('visible=true').locator(CON_IMAGEN);

/**
 * Recorre el listado del inventario de a una pantalla, desde arriba, hasta ver el título.
 * El listado se arma por ventanas: un objeto del medio no está dibujado si solo se baja hasta el final.
 */
async function bajarHastaVer(page, titulo) {
    const objetivo = page.getByText(titulo, { exact: true }).locator('visible=true');
    let alturaPrevia = -1;
    let sinCambios = 0;
    for (let i = 0; i < 300; i++) {
        if (await objetivo.count() > 0) return;
        const estado = await page.evaluate(() => {
            const visible = (e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
            };
            const lista = [...document.querySelectorAll('div')].filter((e) => {
                const o = getComputedStyle(e).overflowY;
                return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight && visible(e);
            }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
            if (!lista) return { alto: 0, alFinal: true };
            lista.scrollTop += lista.clientHeight * 0.8;
            return { alto: lista.scrollHeight, alFinal: lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 2 };
        });
        await page.waitForTimeout(250);
        if (estado.alFinal) {
            // Al final se espera la carga de la página siguiente; si la altura no crece, no hay más.
            await page.waitForTimeout(700);
            // Alto 0: todavía no hay listado desplazable (la primera página sigue cargando); no cuenta como final.
            sinCambios = estado.alto !== 0 && estado.alto === alturaPrevia ? sinCambios + 1 : 0;
            if (sinCambios >= 10) break;
        } else {
            sinCambios = 0;
        }
        alturaPrevia = estado.alto;
    }
    await expect(objetivo, `el objeto "${titulo}" no apareció al recorrer el listado completo`).toHaveCount(1, { timeout: 2000 });
}

/** Abre Ver inventario, busca el objeto por título y entra a sus Detalles. */
async function abrirDetalleDe(page, titulo) {
    await irPorMenu(page, 'Ver inventario');
    await bajarHastaVer(page, titulo);
    const detalle = esperarRespuesta(page, 'POST', '/found-objects/getDetail');
    await tarjetaDe(page, titulo).getByText('Detalles', { exact: true }).click();
    expect((await detalle).status()).toBe(200);
    await expect(page.getByText('Datos del objeto')).toBeVisible();
}

/** El modal abierto (aviso de éxito, opinión sobre la app). */
const modalAbierto = (page) => page.locator('[aria-modal="true"]');

module.exports = { irPorMenu, bajarHastaVer, tarjetas, tarjetaDe, abrirDetalleDe, modalAbierto, CON_IMAGEN };
