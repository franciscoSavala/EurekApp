const { test, expect } = require('@playwright/test');
const { abrirMenu, caso, irAlMenu } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    ADMIN, visible, irAlReporte, panel, abrirConfiguracion, fijarFecha, elegir, generar, generarRango,
    alertasApi, enRango, leyendaTorta,
} = require('./helpers/t06');

const DUENO = 'owner.unc@eurekapp.com';
// Fecha de hoy y de hace 30 días en hora argentina (no en hora universal).
const hoyAr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const restarDias = (isoDia, n) => {
    const d = new Date(`${isoDia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
};
// Rango cerrado en el pasado: el seed trae alertas ahí y ningún test las agrega después.
const DESDE = '2026-01-01';
const HASTA = '2026-10-31';

test.describe('Reporte de fraude: filtros y generación', () => {
    // El menú del dueño de organización no tiene Alertas de fraude: la pantalla es del administrador.
    test('caso 215: el dueño de organización filtra el reporte por organización @fraude @reportefraude @paralelo', async ({ browser }) => {
        test.setTimeout(120_000);
        const { context, page } = await abrirComo(browser, DUENO);
        try {
            await caso(215, 'el dueño ingresa al reporte, elige una organización y solo ve usuarios con fraude de esa organización', async () => {
                let llego = false;
                await abrirMenu(page);
                const opcion = page.locator('a', { has: page.getByText('Alertas de fraude', { exact: true }) });
                if (await opcion.count() > 0) {
                    await opcion.click();
                    await visible(page.getByText('Ver reporte', { exact: true })).click({ timeout: 10_000 }).catch(() => {});
                    llego = await visible(page.getByText('Generar reporte', { exact: true })).isVisible().catch(() => false);
                }
                expect.soft(llego, 'el dueño de organización no ve Alertas de fraude en su menú, así que no llega al reporte').toBe(true);
                if (!llego) return;
                await expect.soft(visible(page.getByText(/^Organizaci[oó]n$/)).first(), 'el reporte no tiene filtro por organización').toBeVisible({ timeout: 3000 });
            });
        } finally {
            await context.close();
        }
    });

    test('casos 144, 145, 146 y 147: acceso al reporte, sus campos y el ingreso de fechas (administrador) @fraude @reportefraude @paralelo', async ({ browser }) => {
        test.setTimeout(180_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            await caso(144, 'desde Alertas de fraude, Ver reporte muestra Reporte de fraude con el panel Configurar reporte', async () => {
                await irAlMenu(page, 'Alertas de fraude');
                await visible(page.getByText('Ver reporte', { exact: true })).click();
                await expect(visible(page.getByText('Reporte de fraude', { exact: true })).first()).toBeVisible();
                await expect(visible(page.getByText('Configurar reporte', { exact: true })).first()).toBeVisible();
            });

            await caso(145, 'el panel muestra Desde, Hasta, Agrupar, Estado, Ordenar por y Generar reporte', async () => {
                await abrirConfiguracion(page);
                const p = panel(page);
                for (const t of ['Desde', 'Hasta', 'Agrupar', 'Por usuario', 'Por DNI', 'Estado', 'Todos', 'Activa', 'Falsa alarma', 'Ordenar por', 'Generar reporte']) {
                    await expect.soft(p.getByText(t, { exact: true }).first(), `falta "${t}"`).toBeVisible();
                }
            });

            await caso(146, 'elegir Desde y un Hasta posterior: ambos muestran la fecha y el rango se acepta', async () => {
                await fijarFecha(page, 'Desde', DESDE);
                await fijarFecha(page, 'Hasta', HASTA);
                await expect(visible(page.getByText(DESDE, { exact: true })).first()).toBeVisible();
                await expect(visible(page.getByText(HASTA, { exact: true })).first()).toBeVisible();
                const datos = await generar(page);
                expect(datos.summary).toBeTruthy();
                await expect(visible(page.getByText(/^\d{4}-\d{2}-\d{2} a \d{4}-\d{2}-\d{2} · /)).first()).toContainText(`${DESDE} a ${HASTA}`);
            });

            await caso(147, 'un rango con Desde mayor a Hasta muestra un error o bloquea la generación', async () => {
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
        } finally {
            await context.close();
        }
    });

    test('casos 148 a 153 y 216: período, estados y generación del reporte (administrador) @fraude @reportefraude @paralelo', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            await irAlReporte(page);
            const resumen = () => visible(page.getByText(/^\d{4}-\d{2}-\d{2} a \d{4}-\d{2}-\d{2} · /)).first();

            await caso(153, 'sin tocar nada se genera con 30 días atrás, hoy (hora argentina), Por DNI y Todos', async () => {
                const hoy = hoyAr();
                const datos = await generar(page);
                expect(datos.entries).toBeDefined();
                await expect.soft(resumen()).toHaveText(`${restarDias(hoy, 30)} a ${hoy} · Por DNI · Todos`);
            });

            await caso(148, 'el reporte solo incluye datos dentro del rango elegido', async () => {
                const d = '2026-07-01', h = '2026-08-31';
                const datos = await generarRango(page, d, h);
                const fuera = datos.summary.periodAlerts.filter((a) => String(a.createdAt).slice(0, 10) < d || String(a.createdAt).slice(0, 10) > h);
                expect(fuera, 'alertas fuera del rango en el reporte').toEqual([]);
                const esperadas = enRango(await alertasApi(page, request), d, h);
                expect(datos.summary.periodAlerts.length).toBe(esperadas.length);
                const l = await leyendaTorta(page);
                expect(l.activas.n + l.falsas.n).toBe(esperadas.length);
            });

            await caso(149, 'el filtro Estado muestra Todos, Activa y Falsa alarma', async () => {
                await abrirConfiguracion(page);
                for (const t of ['Todos', 'Activa', 'Falsa alarma']) {
                    await expect.soft(panel(page).getByText(t, { exact: true }), `no hay opción de estado "${t}"`).toBeVisible({ timeout: 3000 });
                }
            });

            await caso(150, 'elegir Falsa alarma y generar: el botón queda resaltado y solo hay falsas alarmas', async () => {
                const color = (t) => panel(page).getByText(t, { exact: true }).evaluate((e) => getComputedStyle(e).color);
                const antes = await color('Falsa alarma');
                const todosAntes = await color('Todos');
                await elegir(page, 'Falsa alarma');
                expect.soft(await color('Falsa alarma'), 'el botón elegido queda resaltado').not.toBe(antes);
                expect.soft(await color('Todos'), 'el botón anterior deja de estar resaltado').not.toBe(todosAntes);
                await fijarFecha(page, 'Desde', DESDE);
                await fijarFecha(page, 'Hasta', HASTA);
                const datos = await generar(page);
                expect(datos.summary.activeCount).toBe(0);
                expect(datos.summary.falsePositiveCount).toBeGreaterThan(0);
                expect((await leyendaTorta(page)).activas.n).toBe(0);
            });

            await caso(151, 'elegir Todos incluye activas y falsas alarmas', async () => {
                await elegir(page, 'Todos');
                const datos = await generar(page);
                expect(datos.summary.activeCount).toBeGreaterThan(0);
                expect(datos.summary.falsePositiveCount).toBeGreaterThan(0);
                await expect(resumen()).toContainText('Todos');
            });

            await caso(152, 'con filtros elegidos se muestran las tarjetas de personas, la torta y la evolución', async () => {
                const datos = await generarRango(page, DESDE, HASTA, 'Todos');
                expect(datos.entries.length).toBeGreaterThan(0);
                await expect(visible(page.getByText('Activas vs. falsas alarmas', { exact: true }))).toBeVisible();
                await expect(visible(page.getByText('Evolución de casos', { exact: true }))).toBeVisible();
                await expect(visible(page.getByText(datos.entries[0].dni, { exact: true })).first()).toBeVisible();
                await expect(resumen()).toContainText(`${DESDE} a ${HASTA} · Por DNI · Todos`);
            });

            // Un rango sin datos: no hay alertas en 2020.
            await caso(216, 'un rango sin alertas muestra "No hay registros de fraude en el período seleccionado"', async () => {
                await generarRango(page, '2020-01-01', '2020-01-31', 'Todos');
                await expect(visible(page.getByText('No hay registros de fraude en el período seleccionado', { exact: true }))).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
