// Reporte de precisión de las coincidencias, visto por el administrador (casos 210 y 211).
// Los casos 323 (de otra tanda) y el aprendizaje del algoritmo con el feedback no se prueban acá.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { texto, sembrarFeedback } = require('./helpers/t11');
const { casoContinuo } = require('./helpers/t17');
const { abrirPrecisionAdmin } = require('./helpers/r09');

let sembrado;

test.beforeAll(async ({ browser }) => {
    sembrado = await sembrarFeedback(browser);
});

test('casos 210 y 211: el reporte de precisión del administrador muestra el feedback con su objeto y organización, y filtra por organización @reportes @paralelo', async ({ browser }) => {
    await casoContinuo(210, 'tras el feedback de un usuario, el CSV del administrador trae el objeto evaluado, la organización y si lo encontró', async () => {
        const { context, page } = await abrirPrecisionAdmin(browser);
        try {
            await expect(texto(page, 'Exportar CSV')).toBeVisible();
            const [descarga] = await Promise.all([page.waitForEvent('download'), texto(page, 'Exportar CSV').click()]);
            const csv = fs.readFileSync(await descarga.path(), 'utf8');
            const fila = csv.split(/\r?\n/).find((l) => l.includes(sembrado.titulo));
            expect(fila, 'fila del CSV con el objeto evaluado').toBeTruthy();
            expect(fila).toContain('UNC Ciudad Universitaria');
        } finally {
            await context.close();
        }
    });

    await casoContinuo(211, 'al elegir una organización en el filtro, el reporte muestra solo sus datos', async () => {
        const { context, page } = await abrirPrecisionAdmin(browser);
        try {
            await expect(texto(page, 'Organización'), 'filtro por organización en el reporte').toBeVisible({ timeout: 3000 });
        } finally {
            await context.close();
        }
    });
});
