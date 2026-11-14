// Reporte de opiniones sobre recompensas (casos 285 a 292). La app no tiene opinión sobre recompensas
// ni reporte de ellas (ver feedback-recompensa.spec.js), así que cada paso busca en la pantalla de
// reportes lo que el caso describe y falla porque no existe.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, irAlMenu } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { visible } = require('./helpers/t11');

// Un paso que falla no corta el test: queda anotado como fallo del paso y sigue con el siguiente.
async function intentar(fn) {
    try {
        await fn();
    } catch (e) {
        expect.soft(null, e.message.split(/\r?\n/)[0]).toBe('sin error');
    }
}

const CORTO = { timeout: 1500 };
const quiere = (page, patron) => visible(page.getByText(patron)).first();

test('casos 285 a 292: reporte de opiniones sobre recompensas @reportes @paralelo', async ({ browser }) => {
    const dueno = await abrirComo(browser, USUARIOS_PARALELO.duenoUnc);
    const { page } = dueno;
    try {
        await irAlMenu(page, 'Reportes');
        await expect(quiere(page, 'Exportar PDF')).toBeVisible();

        await test.step('caso 285: el reporte permite filtrar el feedback por tipo de recompensa (Puntos o Insignias)', async () => intentar(async () => {
            await expect(quiere(page, /tipo de recompensa/i)).toBeVisible(CORTO);
            await expect(quiere(page, /^Puntos$/)).toBeVisible(CORTO);
            await expect(quiere(page, /^Insignias$/)).toBeVisible(CORTO);
        }));

        await test.step('caso 286: el reporte muestra cuántos usuarios quedaron satisfechos e insatisfechos con las recompensas', async () => intentar(async () => {
            await expect(quiere(page, /satisfechos/i)).toBeVisible(CORTO);
            await expect(quiere(page, /insatisfechos/i)).toBeVisible(CORTO);
        }));

        await test.step('caso 287: el reporte muestra la relación entre recompensas otorgadas y satisfacción', async () => intentar(async () => {
            await expect(quiere(page, /recompensas otorgadas/i)).toBeVisible(CORTO);
            await expect(quiere(page, /satisfacción/i)).toBeVisible(CORTO);
        }));

        await test.step('caso 288: el reporte identifica las recompensas mejor valoradas', async () => intentar(async () => {
            await expect(quiere(page, /mejor valoradas/i)).toBeVisible(CORTO);
        }));

        await test.step('caso 290: el reporte diferencia el feedback de cada tipo de recompensa', async () => intentar(async () => {
            await expect(quiere(page, /recompensa/i)).toBeVisible(CORTO);
            await expect(quiere(page, /^Puntos$/)).toBeVisible(CORTO);
            await expect(quiere(page, /^Insignias$/)).toBeVisible(CORTO);
        }));

        await test.step('caso 291: el reporte muestra métricas de recompensas (promedio de satisfacción, distribución de calificaciones, feedbacks por tipo)', async () => intentar(async () => {
            await expect(quiere(page, /promedio de satisfacción/i)).toBeVisible(CORTO);
            await expect(quiere(page, /distribución de calificaciones/i)).toBeVisible(CORTO);
            await expect(quiere(page, /feedbacks? por tipo/i)).toBeVisible(CORTO);
        }));

        await test.step('caso 292: el reporte muestra un gráfico de satisfacción por recompensa', async () => intentar(async () => {
            await expect(quiere(page, /satisfacción por recompensa/i)).toBeVisible(CORTO);
        }));
    } finally {
        await dueno.context.close();
    }

    const usuario = await abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
    try {
        await test.step('caso 289: el usuario que recibió una recompensa abre su formulario de feedback, califica, comenta y envía', async () => intentar(async () => {
            await irAlMenu(usuario.page, 'Logros');
            const boton = quiere(usuario.page, /Dar feedback/i);
            await expect(boton).toBeVisible({ timeout: 4000 });
            await boton.click(CORTO);
            await expect(quiere(usuario.page, 'Enviar')).toBeVisible(CORTO);
        }));
    } finally {
        await usuario.context.close();
    }
});
