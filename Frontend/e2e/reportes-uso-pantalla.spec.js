const { test, expect } = require('@playwright/test');
const { USUARIOS } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { abrirMenu, irAlMenu } = require('./helpers');
const h = require('./helpers/t10');

test.describe('Reportes: pantalla y métricas', () => {
    test('casos 173, 174, 175, 235 y 236: el dueño ve la pantalla de reportes, sus secciones y métricas, y el estado sin datos @reportes @reportesuso @paralelo', async ({ browser }) => {
        const r = await h.abrirReportes(browser);
        const { page } = r;

        await test.step('caso 173: el sistema muestra la pantalla de reportes', async () => {
            await expect(page.getByText('Reporte de uso', { exact: true }).locator('visible=true')).toBeVisible();
            await expect(page.getByText('Desde', { exact: true }).locator('visible=true')).toBeVisible();
            await expect(page.getByText('Hasta', { exact: true }).locator('visible=true')).toBeVisible();
        });

        await test.step('caso 174: se muestran valores numéricos de objetos, búsquedas y usuarios', async () => {
            const esperado = {
                'Objetos encontrados': r.uso.found_objects,
                'Búsquedas / perdidos': r.uso.lost_objects,
                'Objetos devueltos': r.uso.returned_objects,
                'Usuarios activos': r.uso.active_users,
            };
            for (const [etiqueta, valor] of Object.entries(esperado)) {
                const mostrado = await h.valorDeTarjeta(page, etiqueta);
                expect.soft(mostrado, etiqueta).toMatch(/^\d+$/);
                expect.soft(Number(mostrado), etiqueta).toBe(valor);
            }
        });

        await test.step('caso 236: las métricas del reporte son valores numéricos', async () => {
            for (const etiqueta of ['Objetos encontrados', 'Búsquedas / perdidos', 'Objetos devueltos', 'Usuarios activos']) {
                expect.soft(await h.valorDeTarjeta(page, etiqueta), etiqueta).toMatch(/^\d+$/);
            }
        });

        await test.step('caso 235: se muestran Reporte de uso, Feedback, Distribución y Tendencias', async () => {
            // Las tendencias solo aparecen si hay períodos: se usa un rango con movimiento.
            await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            await expect.soft(page.getByText('Reporte de uso', { exact: true }).locator('visible=true')).toBeVisible();
            await expect.soft(page.getByText(/Feedback/).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.getByText(/Distribuci[oó]n/).locator('visible=true').first(), 'sección Distribución').toBeVisible({ timeout: 2000 });
            await expect.soft(page.getByText('Tendencias', { exact: true }).locator('visible=true')).toBeVisible();
        });

        await test.step('caso 175: sin datos se muestra el estado vacío "No hay reportes"', async () => {
            await h.cambiarFecha(page, 'Desde', '2020-01-01');
            const vacio = await h.cambiarFecha(page, 'Hasta', '2020-01-31');
            // El rango antiguo no tiene movimiento: el servidor devuelve períodos vacíos.
            expect(vacio.uso.time_series).toEqual([]);
            await expect.soft(page.getByText('No hay reportes').locator('visible=true').first()).toBeVisible({ timeout: 3000 });
        });
        await r.context.close();
    });

    test('caso 177: el administrador ve el botón Ver reporte en la pantalla de fraude @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComo(browser, USUARIOS.admin);
        await irAlMenu(page, 'Alertas de fraude');
        await expect(page.getByText('Ver reporte', { exact: true }).locator('visible=true')).toBeVisible();
        await context.close();
    });

    test('caso 178: el dueño de la organización presiona Ver reporte @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComo(browser, h.DUENO);
        await abrirMenu(page);
        // El dueño no tiene la pantalla de fraude en su menú: de ahí sale el botón Ver reporte.
        const enlace = page.locator('a', { has: page.getByText('Alertas de fraude', { exact: true }) });
        await expect(enlace, 'el menú del dueño debería dar acceso a la pantalla con el botón Ver reporte').toBeVisible({ timeout: 3000 });
        await enlace.click();
        await page.getByText('Ver reporte', { exact: true }).locator('visible=true').click();
        await expect(page.getByText(/Reporte de fraude|Reporte de uso/).locator('visible=true').first()).toBeVisible();
        await context.close();
    });
});
