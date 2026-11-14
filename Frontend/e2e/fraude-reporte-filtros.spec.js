const { test, expect } = require('@playwright/test');
const { abrirMenu, caso } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    ADMIN, visible, irAlReporte, panel, abrirConfiguracion, fijarFecha, elegir, generar, generarRango,
    alertasApi, enRango, leyendaTorta,
} = require('./helpers/t06');

const DUENO = 'owner.unc@eurekapp.com';
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Rango cerrado en el pasado: el seed trae alertas ahí y ningún test las agrega después.
const DESDE = '2026-01-01';
const HASTA = '2026-10-31';

test.describe('Reporte de fraude: filtros y generación', () => {
    // El menú del dueño de organización no tiene Alertas de fraude: la pantalla es del administrador.
    test('casos 181, 182 y 298: el dueño de organización accede al reporte, ve sus campos y filtra por organización @fraude @reportefraude @paralelo', async ({ browser }) => {
        test.setTimeout(120_000);
        const { context, page } = await abrirComo(browser, DUENO);
        try {
            const opcion = () => page.locator('a', { has: page.getByText('Alertas de fraude', { exact: true }) });
            let llego = false;
            await caso(181, 'el dueño entra a Alertas de fraude y con Ver reporte llega al Reporte de fraude', async () => {
                await abrirMenu(page);
                if (await opcion().count() > 0) {
                    await opcion().click();
                    await visible(page.getByText('Ver reporte', { exact: true })).click({ timeout: 10_000 }).catch(() => {});
                    llego = await visible(page.getByText('Generar reporte', { exact: true })).isVisible().catch(() => false);
                }
                expect.soft(llego, 'el dueño de organización no ve la opción Alertas de fraude en su menú, así que no llega al Reporte de fraude').toBe(true);
            });
            await caso(182, 'el dueño ve Desde, Hasta, Estado y el botón Generar reporte', async () => {
                expect.soft(llego, 'el dueño no llega a la pantalla del reporte').toBe(true);
                if (!llego) return;
                for (const t of ['Desde', 'Hasta', 'Estado', 'Generar reporte']) {
                    await expect.soft(visible(page.getByText(t, { exact: true })).first()).toBeVisible();
                }
            });
            await caso(298, 'el dueño elige una organización y el reporte muestra solo sus usuarios con fraude', async () => {
                expect.soft(llego, 'el dueño no llega a la pantalla del reporte').toBe(true);
                if (!llego) return;
                await expect.soft(visible(page.getByText(/^Organizaci[oó]n$/)).first(), 'el reporte no tiene filtro por organización').toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('casos 183 a 195 y 299: fechas, estados y generación del reporte (administrador) @fraude @reportefraude @paralelo', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            await irAlReporte(page);
            const resumen = () => visible(page.getByText(/^\d{4}-\d{2}-\d{2} a \d{4}-\d{2}-\d{2} · /)).first();

            await caso(193, 'sin tocar filtros se genera el reporte con los valores por defecto', async () => {
                const hoy = new Date();
                const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
                const datos = await generar(page);
                expect(datos.entries).toBeDefined();
                await expect.soft(resumen()).toHaveText(`${iso(hace30)} a ${iso(hoy)} · Por usuario · Todos`);
            });

            await caso(183, 'se puede ingresar la fecha Desde', async () => {
                await fijarFecha(page, 'Desde', DESDE);
                await expect(visible(page.getByText(DESDE, { exact: true }))).toBeVisible();
            });
            await caso(184, 'se puede ingresar la fecha Hasta', async () => {
                await fijarFecha(page, 'Hasta', HASTA);
                await expect(visible(page.getByText(HASTA, { exact: true }))).toBeVisible();
            });
            await caso(185, 'un rango con Desde menor a Hasta se acepta y genera el reporte', async () => {
                const datos = await generar(page);
                expect(datos.summary).toBeTruthy();
                await expect(resumen()).toContainText(`${DESDE} a ${HASTA}`);
            });

            await caso(187, 'el reporte solo incluye datos dentro del rango elegido', async () => {
                const d = '2026-07-01', h = '2026-08-31';
                const datos = await generarRango(page, d, h);
                const fuera = datos.summary.periodAlerts.filter((a) => String(a.createdAt).slice(0, 10) < d || String(a.createdAt).slice(0, 10) > h);
                expect(fuera, 'alertas fuera del rango en el reporte').toEqual([]);
                const esperadas = enRango(await alertasApi(page, request), d, h);
                expect(datos.summary.periodAlerts.length).toBe(esperadas.length);
                const l = await leyendaTorta(page);
                expect(l.activas.n + l.falsas.n).toBe(esperadas.length);
            });

            await caso(188, 'se muestran los estados Todos, Pendiente, Confirmado y Falso positivo', async () => {
                await abrirConfiguracion(page);
                for (const t of ['Todos', 'Pendiente', 'Confirmado', 'Falso positivo']) {
                    await expect.soft(panel(page).getByText(t, { exact: true }), `no hay opción de estado "${t}"`).toBeVisible({ timeout: 3000 });
                }
            });

            await caso(189, 'el estado elegido queda marcado visualmente', async () => {
                const color = (t) => panel(page).getByText(t, { exact: true }).evaluate((e) => getComputedStyle(e).color);
                const antes = await color('Falsa alarma');
                const todosAntes = await color('Todos');
                await elegir(page, 'Falsa alarma');
                expect(await color('Falsa alarma')).not.toBe(antes);
                expect(await color('Todos')).not.toBe(todosAntes);
            });

            await caso(190, 'filtrar por Falsa alarma deja solo falsas alarmas; por Activa, solo activas', async () => {
                // Estado Falsa alarma ya quedó elegido en el paso anterior.
                await fijarFecha(page, 'Desde', DESDE);
                await fijarFecha(page, 'Hasta', HASTA);
                let datos = await generar(page);
                expect(datos.summary.activeCount).toBe(0);
                expect(datos.summary.falsePositiveCount).toBeGreaterThan(0);
                expect((await leyendaTorta(page)).activas.n).toBe(0);
                await elegir(page, 'Activa');
                datos = await generar(page);
                expect(datos.summary.falsePositiveCount).toBe(0);
                expect(datos.summary.activeCount).toBeGreaterThan(0);
                expect((await leyendaTorta(page)).falsas.n).toBe(0);
            });

            await caso(191, 'elegir Todos incluye activas y falsas alarmas', async () => {
                await elegir(page, 'Todos');
                const datos = await generar(page);
                expect(datos.summary.activeCount).toBeGreaterThan(0);
                expect(datos.summary.falsePositiveCount).toBeGreaterThan(0);
                await expect(resumen()).toContainText('Todos');
            });

            await caso(192, 'con filtros configurados el reporte se genera', async () => {
                const datos = await generarRango(page, '2026-04-01', HASTA, 'Activa');
                expect(datos.entries.length).toBeGreaterThan(0);
                await expect(resumen()).toContainText(`2026-04-01 a ${HASTA} · Por usuario · Activa`);
            });

            await caso(194, 'los resultados se muestran en pantalla', async () => {
                const datos = await generarRango(page, DESDE, HASTA, 'Todos');
                await expect(visible(page.getByText('Activas vs. falsas alarmas', { exact: true }))).toBeVisible();
                await expect(visible(page.getByText('Evolución de casos', { exact: true }))).toBeVisible();
                await expect(visible(page.getByText(datos.entries[0].email, { exact: true }))).toBeVisible();
            });

            await caso(186, 'un rango con Desde mayor a Hasta muestra un error o bloquea la generación', async () => {
                await fijarFecha(page, 'Desde', HASTA);
                await fijarFecha(page, 'Hasta', DESDE);
                let pedido = false;
                const h = (r) => { if (r.url().includes('/fraud-alerts/report?')) pedido = true; };
                page.on('request', h);
                await visible(page.getByText('Generar reporte', { exact: true })).click();
                await page.waitForTimeout(3000);
                page.off('request', h);
                const aviso = await visible(page.getByText(/inv[aá]lid|incorrect|no puede ser|debe ser (menor|anterior|posterior)|error/i)).count();
                expect.soft(!pedido || aviso > 0, 'con Desde mayor que Hasta la app genera el reporte igual y no avisa del error').toBe(true);
            });

            // Un rango sin datos: no hay alertas en 2020.
            await caso(195, 'sin datos en el rango aparece "No hay usuarios con fraude en el período seleccionado"', async () => {
                await generarRango(page, '2020-01-01', '2020-01-31', 'Todos');
                await expect.soft(visible(page.getByText('No hay usuarios con fraude en el período seleccionado', { exact: true }))).toBeVisible({ timeout: 3000 });
            });
            await caso(299, 'sin usuarios con fraude para los criterios aparece un mensaje que lo indica', async () => {
                await expect(visible(page.getByText(/^No hay (usuarios|registros) .*fraude/))).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
