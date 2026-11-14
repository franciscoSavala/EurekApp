// Tanda T03: aviso de confirmación de la recepción y modal de opinión (carril paralelo, empleado de Aeropuerto).
// La app ya no pide la opinión al receptar un objeto: el mismo modal se abre desde "Mi perfil".
const { test, expect } = require('@playwright/test');
const { caso, nombreUnico, irAlMenu } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { MENSAJE_EXITO, EMPLEADO_AERO, receptarMinimo } = require('./helpers/t03');

const TITULO_MODAL = '¿Cómo fue tu experiencia?';
const ASPECTOS = ['Facilidad de uso', 'Claridad de interfaz', 'Tiempo de respuesta', 'Navegación'];

const modal = (page) => page.locator('[aria-modal="true"]');
const estrellas = (page) => modal(page).locator('div[tabindex="0"]').filter({ has: page.locator('div[style*="FontAwesome6"]') });
const colorDe = (el) => el.evaluate((e) => getComputedStyle(e.querySelector('div[style*="FontAwesome6"]')).color);
const fondoDe = (el) => el.evaluate((e) => getComputedStyle(e).backgroundColor);
const chip = (page, texto) => modal(page).getByText(texto, { exact: true }).locator('xpath=..');
const botonEnviar = (page) => modal(page).getByText('Enviar', { exact: true });
const GRIS = 'rgb(204, 204, 204)';

/** Abre el modal de opinión desde Mi perfil. */
async function abrirModal(page) {
    await irAlMenu(page, 'Mi perfil');
    await page.getByText('Dar feedback de usabilidad de la app').locator('visible=true').click();
    await expect(modal(page).getByText(TITULO_MODAL)).toBeVisible();
}

/** Vigila los envíos de opinión al servidor. */
function vigilarEnvios(page) {
    const envios = [];
    page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().includes('/usability-feedback')) envios.push(r.postDataJSON());
    });
    return envios;
}

test.describe('Recepción: confirmación y opinión', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 096 y 097: el aviso de confirmación se cierra y después debería aparecer la opinión de la experiencia @recepcion @paralelo', async () => {
        const respuesta = await receptarMinimo(page, nombreUnico('Objeto confirmacion e2e'));
        expect(respuesta.status()).toBe(200);
        await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();

        await caso(96, 'al presionar Cerrar el sistema cierra el modal de confirmación', async () => {
            await page.getByText('Cerrar', { exact: true }).click();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });

        await caso(97, 'después de cerrar el modal de confirmación el sistema muestra el modal de feedback de experiencia', async () => {
            await expect(page.getByText(TITULO_MODAL)).toBeVisible({ timeout: 6000 });
        });
    });

    test('casos 099, 100, 101, 104, 107, 103, 102, 106 y 105: modal de opinión @recepcion @paralelo', async () => {
        const envios = vigilarEnvios(page);
        await abrirModal(page);

        await caso(107, 'el modal muestra estrellas, etiquetas, campo de texto, botón Enviar y botón Omitir', async () => {
            await expect(estrellas(page)).toHaveCount(5);
            for (const aspecto of ASPECTOS) await expect(modal(page).getByText(aspecto, { exact: true })).toBeVisible();
            await expect(modal(page).getByPlaceholder('Comentario opcional...')).toBeVisible();
            await expect(botonEnviar(page)).toBeVisible();
            await expect(modal(page).getByText('Omitir', { exact: true })).toBeVisible();
        });

        await caso(104, 'sin estrellas ni comentario el botón Enviar está bloqueado y no se envía nada', async () => {
            await expect(botonEnviar(page).locator('xpath=ancestor::div[@aria-disabled="true"]')).toHaveCount(1);
            await botonEnviar(page).click({ force: true });
            await page.waitForTimeout(1000);
            expect(envios).toHaveLength(0);
            await expect(modal(page).getByText(TITULO_MODAL)).toBeVisible();
        });

        await caso(99, 'al elegir tres estrellas quedan marcadas las tres primeras y las demás no', async () => {
            await estrellas(page).nth(2).click();
            for (let i = 0; i < 5; i++) {
                const color = await colorDe(estrellas(page).nth(i));
                if (i < 3) expect.soft(color, `la estrella ${i + 1} debería estar marcada`).not.toBe(GRIS);
                else expect.soft(color, `la estrella ${i + 1} no debería estar marcada`).toBe(GRIS);
            }
        });

        await caso(100, 'las etiquetas elegidas quedan marcadas y las otras no', async () => {
            const sinMarcar = await fondoDe(chip(page, 'Claridad de interfaz'));
            await chip(page, 'Facilidad de uso').click();
            await chip(page, 'Navegación').click();
            await expect.poll(() => fondoDe(chip(page, 'Facilidad de uso'))).not.toBe(sinMarcar);
            await expect.poll(() => fondoDe(chip(page, 'Navegación'))).not.toBe(sinMarcar);
            expect(await fondoDe(chip(page, 'Claridad de interfaz'))).toBe(sinMarcar);
        });

        const comentario = nombreUnico('Comentario e2e');
        await caso(101, 'el campo de comentario acepta texto libre', async () => {
            const campo = modal(page).getByPlaceholder('Comentario opcional...');
            await campo.fill(comentario);
            await expect(campo).toHaveValue(comentario);
        });

        await caso(102, 'con estrellas, etiquetas y comentario, Enviar manda la opinión completa y cierra el modal', async () => {
            await botonEnviar(page).click();
            await expect.poll(() => envios.length).toBe(1);
            expect(envios[0].starRating).toBe(3);
            expect([...envios[0].aspects].sort()).toEqual(['FACILIDAD_USO', 'NAVEGACION']);
            expect(envios[0].comment).toBe(comentario);
            await expect(modal(page)).toHaveCount(0, { timeout: 6000 });
        });

        await abrirModal(page);
        await estrellas(page).nth(3).click();
        await botonEnviar(page).click();

        await caso(106, 'después de enviar, el modal muestra "Gracias por tu retroalimentación" y se cierra solo', async () => {
            await expect(modal(page).getByText('Gracias por tu retroalimentación', { exact: false })).toBeVisible();
            await expect(modal(page)).toHaveCount(0, { timeout: 6000 });
        });

        await caso(103, 'con solo estrellas el sistema permite enviar la opinión sin completar otros campos', async () => {
            await expect.poll(() => envios.length).toBe(2);
            expect(envios[1].starRating).toBe(4);
            expect(envios[1].aspects).toEqual([]);
            expect(envios[1].comment).toBeNull();
        });

        await abrirModal(page);
        await estrellas(page).nth(4).click();
        await caso(105, 'Omitir cierra el modal sin guardar la opinión y lleva a la pantalla de Receptar un objeto', async () => {
            await modal(page).getByText('Omitir', { exact: true }).click();
            await expect(modal(page)).toHaveCount(0);
            await page.waitForTimeout(500);
            expect.soft(envios).toHaveLength(2);
            await expect(page.getByText('Receptar un objeto', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 3000 });
            await expect(page.getByPlaceholder('Escribe un título')).toBeVisible();
        });
    });
});
