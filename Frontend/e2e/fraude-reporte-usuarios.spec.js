const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    ADMIN, visible, irAlReporte, abrirConfiguracion, elegir, fijarFecha, generar, generarRango, tarjeta, alertasApi, enRango, numeroDe,
} = require('./helpers/t06');
const { colorDe, nombresEnOrden } = require('./helpers/r06');

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
    test('casos 213, 214, 354 y 355: historial, orden, reincidentes y cantidades por usuario (administrador) @fraude @reportefraude @paralelo', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            // El administrador llega al reporte por Alertas de fraude > Ver reporte: no tiene un menú Reportes.
            await irAlReporte(page);
            let datos = await generarRango(page, ...RECIENTE);
            expect(datos.entries.length, 'el seed debería traer usuarios con fraude en el rango').toBeGreaterThan(1);

            await caso(213, 'el historial de un usuario muestra fecha, tipo, estado y detalle de cada incidente', async () => {
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

            await caso(354, 'la persona con alertas anteriores al período muestra "⚠ Reincidente" y la otra no', async () => {
                const rein = datos.entries.filter((e) => e.priorCount > 0);
                const otras = datos.entries.filter((e) => !(e.priorCount > 0));
                expect(rein.length, 'el seed debería traer reincidentes').toBeGreaterThan(0);
                expect(otras.length, 'el seed debería traer personas sin alertas anteriores').toBeGreaterThan(0);
                for (const e of rein) {
                    await expect.soft(tarjeta(page, e.email).getByText('⚠ Reincidente'), `${e.email} tiene alertas anteriores`).toBeVisible();
                }
                for (const e of otras) {
                    await expect.soft(tarjeta(page, e.email).getByText('⚠ Reincidente'), `${e.email} no tiene alertas anteriores`).toHaveCount(0);
                }
            });

            await caso(214, 'al ordenar por Total del período y por Reincidencia la lista queda de mayor a menor (por defecto, Activas)', async () => {
                expect.soft(noCreciente(await valoresEnOrden(page, 'Activas')), 'orden por defecto: Activas').toBe(true);
                const total = await valoresEnOrden(page, 'En el período');
                expect.soft(noCreciente(total), `con el orden por defecto el total del período también baja: ${total.join(', ')}`).toBe(true);
                await elegir(page, 'Total del período');
                expect(noCreciente(await valoresEnOrden(page, 'En el período'))).toBe(true);
                await elegir(page, 'Reincidencia');
                expect(noCreciente(await valoresEnOrden(page, 'Histórico acumulado'))).toBe(true);
            });

            await caso(355, 'cada tarjeta muestra En el período, Activas, Falsas alarmas e Histórico acumulado y coinciden con las alertas', async () => {
                datos = await generarRango(page, ...TODO);
                const alertas = enRango(await alertasApi(page, request), ...TODO);
                const porUsuario = new Map();
                for (const a of alertas) for (const u of a.suspectUsers || []) porUsuario.set(u.email, (porUsuario.get(u.email) || 0) + 1);
                expect([...datos.entries.map((e) => e.email)].sort()).toEqual([...porUsuario.keys()].sort());
                for (const e of datos.entries) {
                    const t = tarjeta(page, e.email);
                    await expect.soft(t, e.email).toContainText(/Activas: \d+/);
                    await expect.soft(t, e.email).toContainText(/Falsas alarmas: \d+/);
                    expect.soft(await numeroDe(t, 'En el período'), `${e.email}: en el período`).toBe(porUsuario.get(e.email));
                    expect.soft(await numeroDe(t, 'En el período'), `${e.email}: en el período (servidor)`).toBe(e.fraudCount);
                    expect.soft(await numeroDe(t, 'Histórico acumulado'), `${e.email}: histórico`).toBe(e.historicalCount);
                }
            });
        } finally {
            await context.close();
        }
    });

    test('casos 212, 217 y 218: agrupar por DNI y ordenar por nombre (administrador) @fraude @reportefraude @paralelo', async ({ browser }) => {
        test.setTimeout(300_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            await irAlReporte(page);

            await caso(212, 'al abrir el reporte está elegido Por DNI y cada fila muestra la insignia DNI y el número, con sus cantidades', async () => {
                // "Todos" es la opción que arranca resaltada en Estado: sirve de referencia del color de una opción elegida.
                const elegida = await colorDe(page, 'Todos');
                expect.soft(await colorDe(page, 'Por DNI'), 'la opción Por DNI debería estar elegida al abrir').toBe(elegida);
                expect.soft(await colorDe(page, 'Por usuario'), 'Por usuario no debería estar elegida').not.toBe(elegida);
                await fijarFecha(page, 'Desde', RECIENTE[0]);
                await fijarFecha(page, 'Hasta', RECIENTE[1]);
                const datos = await generar(page);
                expect(datos.entries.length).toBeGreaterThan(0);
                await expect.soft(visible(page.getByText('DNI', { exact: true })).first(), 'insignia DNI en las filas').toBeVisible({ timeout: 2000 });
                const e = datos.entries[0];
                if (e.email) await expect.soft(visible(page.getByText(e.email, { exact: true })), 'el email no debería verse').toHaveCount(0, { timeout: 2000 });
                await expect.soft(visible(page.getByText(/^En el período: \d+/)).first()).toBeVisible();
                await expect.soft(visible(page.getByText(/^Activas: \d+/)).first()).toBeVisible();
                await expect.soft(visible(page.getByText(/^Falsas alarmas: \d+/)).first()).toBeVisible();
                await expect.soft(visible(page.getByText(/^Histórico acumulado/)).first()).toBeVisible();
            });

            await caso(217, 'agrupando Por DNI cada fila muestra el DNI, sin nombre ni email', async () => {
                await elegir(page, 'Por DNI');
                await fijarFecha(page, 'Desde', TODO[0]);
                await fijarFecha(page, 'Hasta', TODO[1]);
                const datos = await generar(page);
                expect(datos.entries.length, 'el seed debería traer alertas con DNI').toBeGreaterThan(0);
                for (const e of datos.entries) {
                    await expect.soft(visible(page.getByText(String(e.dni), { exact: true })).first(), `DNI ${e.dni}`).toBeVisible();
                    if (e.email) await expect.soft(visible(page.getByText(e.email, { exact: true })), `no debería verse ${e.email}`).toHaveCount(0);
                    if (e.fullName) await expect.soft(visible(page.getByText(e.fullName, { exact: true })), `no debería verse ${e.fullName}`).toHaveCount(0);
                }
                await expect.soft(visible(page.getByText('DNI', { exact: true })).first(), 'insignia DNI').toBeVisible();
            });

            await caso(218, 'Nombre A-Z ordena alfabéticamente Por usuario y no aparece Por DNI', async () => {
                await elegir(page, 'Por usuario');
                // Las opciones de orden siguen al agrupamiento con que se generó el reporte: hay que regenerar.
                await generar(page);
                await elegir(page, 'Nombre A-Z');
                const datos = await generar(page);
                expect(datos.entries.length).toBeGreaterThan(1);
                const nombres = (await nombresEnOrden(page)).filter(Boolean);
                expect(nombres.length).toBeGreaterThan(1);
                const ordenados = await page.evaluate((n) => [...n].sort((a, b) => a.localeCompare(b)), nombres);
                expect(nombres, 'las tarjetas deberían salir en orden alfabético').toEqual(ordenados);
                await elegir(page, 'Por DNI');
                await generar(page);
                await abrirConfiguracion(page);
                await expect(visible(page.getByText('Nombre A-Z', { exact: true }))).toHaveCount(0);
                await expect(visible(page.getByText('Total del período', { exact: true })).first()).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
