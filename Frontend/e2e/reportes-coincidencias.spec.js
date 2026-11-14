// Reporte de opiniones sobre coincidencias del responsable de organización (casos 281 a 283).
// El caso 284 (uso del feedback para mejorar el algoritmo) no se automatiza: ver el informe de la tanda.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO } = require('./helpers');
const { URL_BACK, ORG_UNC, texto, auth, tokenDe, sembrarFeedback, abrirReporteUso } = require('./helpers/t11');

const DESDE = '2020-01-01';
const HASTA = '2100-01-01';
let sembrado;

test.beforeAll(async ({ browser }) => {
    sembrado = await sembrarFeedback(browser);
});

test('casos 281 y 282: el feedback queda asociado a la coincidencia y a la organización, y el reporte muestra una sola organización @reportes @paralelo', async ({ browser }) => {
    const { context, page } = await abrirReporteUso(browser);
    try {
        const token = await tokenDe(page);
        const registros = async () => {
            const r = await page.request.get(`${URL_BACK}/feedback/records?from=${DESDE}&to=${HASTA}`, { headers: auth(token) });
            expect(r.ok()).toBe(true);
            return r.json();
        };

        await test.step('caso 281: el feedback enviado sobre una coincidencia figura en el reporte, con su objeto, su organización y si lo encontró', async () => {
            const lista = await registros();
            const propio = lista.find((x) => x.foundObjectTitle === sembrado.titulo);
            expect(propio, 'el registro del objeto evaluado').toBeTruthy();
            expect(String(propio.organizationId)).toBe(String(ORG_UNC));
            expect(propio.wasFound).toBe(true);
            // También aparece en lo que descarga el responsable (reporte de la pantalla).
            await page.reload();
            await expect(texto(page, 'Exportar CSV')).toBeVisible();
            const [descarga] = await Promise.all([page.waitForEvent('download'), texto(page, 'Exportar CSV').click()]);
            const csv = fs.readFileSync(await descarga.path(), 'utf8');
            const fila = csv.split(/\r?\n/).find((l) => l.includes(sembrado.titulo));
            expect(fila, 'fila del CSV con el objeto evaluado').toBeTruthy();
            expect(fila).toContain('UNC Ciudad Universitaria');
            await expect(texto(page, 'Búsquedas registradas')).toBeVisible();
        });

        await test.step('caso 282: el reporte permite elegir una organización y muestra solo los datos de esa organización', async () => {
            // La pantalla del responsable no trae selector de organización: trae siempre la suya.
            await expect.soft(texto(page, 'Organización'), 'selector de organización en la pantalla de reportes').toBeVisible({ timeout: 3000 });
            const lista = await registros();
            expect(lista.length).toBeGreaterThan(0);
            for (const x of lista) expect(String(x.organizationId)).toBe(String(ORG_UNC));
        });
    } finally {
        await context.close();
    }
});
