// Reporte de precisión de las coincidencias, visto por el administrador (casos 210 y 211).
// Los casos 323 (de otra tanda) y el aprendizaje del algoritmo con el feedback no se prueban acá.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { texto, sembrarFeedback } = require('./helpers/t11');
const { casoContinuo } = require('./helpers/t17');
const { abrirPrecisionAdmin } = require('./helpers/r09');
const r8 = require('./helpers/r08');

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
            // Por defecto incluye todas las organizaciones; al elegir una, el reporte trae solo sus datos.
            await expect(texto(page, 'Todas')).toBeVisible();
            // La carga inicial del reporte pide los registros: se espera a que termine para no tomarla por el pedido del filtro.
            await page.waitForLoadState('networkidle');
            // Se espera la respuesta que ya lleva la organización: una carga inicial tardía no se confunde con el pedido del filtro.
            const alRegistro = r8.esperarJson(page, '/feedback/records?', (u) => u.searchParams.has('organizationId'));
            await texto(page, 'UNC Ciudad Universitaria').click();
            const { url, cuerpo } = await alRegistro;
            expect(url.searchParams.get('organizationId'), 'el pedido lleva la organización elegida').toBeTruthy();
            expect(cuerpo.length, 'registros de la organización elegida').toBeGreaterThan(0);
            expect(new Set(cuerpo.map((r) => r.organizationId)).size, 'una sola organización en los registros').toBe(1);
        } finally {
            await context.close();
        }
    });
});
