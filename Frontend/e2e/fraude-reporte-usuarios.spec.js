const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    ADMIN, visible, irAlReporte, elegir, generarRango, tarjeta, alertasApi, enRango, numeroDe,
} = require('./helpers/t06');

// Rangos cerrados en el pasado: el seed trae alertas ahí y ningún test las agrega después.
const TODO = ['2026-01-01', '2026-10-31'];
// Desde agosto: los usuarios con alertas anteriores quedan marcados como reincidentes.
const RECIENTE = ['2026-08-01', '2026-10-31'];

/** Valores "En el período: N" (o el rótulo que se pida) de las tarjetas visibles, en el orden de pantalla. */
async function valoresEnOrden(page, rotulo) {
    const textos = await visible(page.getByText(new RegExp(`^${rotulo}: \\d+`))).allInnerTexts();
    return textos.map((t) => Number(t.match(/(\d+)/)[1]));
}
const noCreciente = (v) => v.every((x, i) => i === 0 || v[i - 1] >= x);

test.describe('Reporte de fraude: usuarios con fraude', () => {
    test('casos 294 a 297 y 493 a 497: usuarios con fraude, historial, reincidentes y orden (administrador) @fraude @reportefraude @paralelo', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            // El administrador llega al reporte por Alertas de fraude > Ver reporte: no tiene un menú Reportes.
            await irAlReporte(page);
            let datos = await generarRango(page, ...RECIENTE);
            expect(datos.entries.length, 'el seed debería traer usuarios con fraude en el rango').toBeGreaterThan(1);

            await caso(294, 'cada usuario muestra ID, nombre, email, foto, cantidad, tipo, fecha y estado', async () => {
                const e = datos.entries[0];
                const t = tarjeta(page, e.email);
                await expect.soft(t.getByText(e.fullName, { exact: true }), 'nombre').toBeVisible();
                await expect.soft(t.getByText(e.email, { exact: true }), 'email').toBeVisible();
                await expect.soft(t, 'cantidad de fraudes').toContainText(`En el período: ${e.fraudCount}`);
                await expect.soft(t.getByText(/Retiros repetidos|Posible/).first(), 'tipo de fraude').toBeVisible();
                await expect.soft(t.getByText(String(e.userId), { exact: true }), 'ID de usuario: la tarjeta no lo muestra').toBeVisible({ timeout: 2000 });
                await expect.soft(t.locator('img, [style*="background-image"]'), 'foto de perfil: solo hay un círculo con iniciales').not.toHaveCount(0, { timeout: 2000 });
                await expect.soft(t.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/), 'fecha del incidente sin abrir el historial').not.toHaveCount(0, { timeout: 2000 });
            });

            await caso(295, 'el historial de un usuario muestra fecha, tipo y estado de cada incidente', async () => {
                const e = datos.entries.find((x) => x.incidents.length > 1) || datos.entries[0];
                const t = tarjeta(page, e.email);
                await t.getByText('ver historial completo').click();
                await expect(t.getByText('Historial de incidentes', { exact: true })).toBeVisible();
                const fechas = await t.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/).count();
                expect(fechas).toBe(e.incidents.length);
                const estados = await t.getByText(/^(Activa|Falsa alarma)$/).count();
                expect(estados).toBe(e.incidents.length);
                await expect(t.getByText(/Retiros repetidos|Posible/).first()).toBeVisible();
                await t.getByText('ocultar historial').click();
            });

            await caso(493, 'los usuarios con más de un caso aparecen en el reporte', async () => {
                const varios = datos.entries.filter((e) => e.historicalCount > 1);
                expect(varios.length, 'el seed debería traer usuarios con más de un caso').toBeGreaterThan(0);
                for (const e of varios) await expect.soft(visible(page.getByText(e.email, { exact: true }))).toBeVisible();
            });

            await caso(494, 'cada usuario muestra la cantidad de casos que tiene', async () => {
                for (const e of datos.entries) {
                    const t = tarjeta(page, e.email);
                    expect.soft(await numeroDe(t, 'En el período'), e.email).toBe(e.fraudCount);
                    expect.soft(await numeroDe(t, 'Histórico acumulado'), e.email).toBe(e.historicalCount);
                }
            });

            await caso(495, 'los usuarios salen ordenados de mayor a menor cantidad de casos', async () => {
                const total = await valoresEnOrden(page, 'En el período');
                expect(total.length).toBe(datos.entries.length);
                expect.soft(noCreciente(total), `orden por defecto según el total de casos: ${total.join(', ')}`).toBe(true);
            });

            await caso(296, 'los reincidentes se identifican y se muestra su cantidad de casos', async () => {
                const rein = datos.entries.filter((e) => e.priorCount > 0);
                expect(rein.length, 'el seed debería traer reincidentes').toBeGreaterThan(0);
                for (const e of rein) {
                    const t = tarjeta(page, e.email);
                    await expect.soft(t.getByText('⚠ Reincidente'), e.email).toBeVisible();
                    expect.soft(await numeroDe(t, 'Histórico acumulado')).toBeGreaterThan(1);
                }
            });

            await caso(496, 'los usuarios reincidentes se destacan visualmente', async () => {
                for (const e of datos.entries) {
                    const chip = tarjeta(page, e.email).getByText('⚠ Reincidente');
                    if (e.historicalCount > 1) await expect.soft(chip, `${e.email} tiene ${e.historicalCount} casos`).toBeVisible();
                    else await expect.soft(chip, `${e.email} tiene un solo caso`).toHaveCount(0);
                }
            });

            await caso(297, 'al elegir ordenar por cantidad de fraudes la lista se reordena', async () => {
                await elegir(page, 'Total del período');
                expect(noCreciente(await valoresEnOrden(page, 'En el período'))).toBe(true);
                await elegir(page, 'Activas');
                expect(noCreciente(await valoresEnOrden(page, 'Activas'))).toBe(true);
                await elegir(page, 'Reincidencia');
                expect(noCreciente(await valoresEnOrden(page, 'Histórico acumulado'))).toBe(true);
            });

            await caso(497, 'los usuarios y cantidades coinciden con los casos registrados', async () => {
                datos = await generarRango(page, ...TODO);
                const alertas = enRango(await alertasApi(page, request), ...TODO);
                const porUsuario = new Map();
                for (const a of alertas) for (const u of a.suspectUsers || []) porUsuario.set(u.email, (porUsuario.get(u.email) || 0) + 1);
                expect([...datos.entries.map((e) => e.email)].sort()).toEqual([...porUsuario.keys()].sort());
                for (const [email, n] of porUsuario) {
                    expect.soft(await numeroDe(tarjeta(page, email), 'En el período'), email).toBe(n);
                }
            });
        } finally {
            await context.close();
        }
    });
});
