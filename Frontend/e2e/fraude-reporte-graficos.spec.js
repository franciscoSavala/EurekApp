const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    ADMIN, visible, irAlReporte, generarRango, alertasApi, enRango, leyendaTorta, bloqueEvolucion, leerEvolucion,
    etiquetaMes,
} = require('./helpers/t06');
const { coloresBarras } = require('./helpers/r06');

// Rangos cerrados en el pasado: el seed trae alertas ahí y ningún test las agrega después.
const TODO = ['2026-01-01', '2026-10-31'];
const CORTO = ['2026-07-01', '2026-08-31'];

const cuenta = (alertas, estado) => alertas.filter((a) => a.status === estado).length;
const suma = (barras, campo) => barras.reduce((s, b) => s + b[campo], 0);

test.describe('Reporte de fraude: gráficos', () => {
    test('casos 356 a 361: torta de activas vs. falsas alarmas y gráfico de evolución (administrador) @fraude @reportefraude @paralelo', async ({ browser, request }) => {
        test.setTimeout(300_000);
        const { context, page } = await abrirComo(browser, ADMIN);
        try {
            // El administrador llega al reporte por Alertas de fraude > Ver reporte: no tiene un menú Reportes.
            await irAlReporte(page);
            await generarRango(page, ...TODO);
            const alertas = await alertasApi(page, request);
            const todas = enRango(alertas, ...TODO);
            const activas = cuenta(todas, 'ACTIVE');
            const falsas = cuenta(todas, 'FALSE_POSITIVE');
            expect(activas, 'el seed debería traer alertas activas').toBeGreaterThan(0);
            expect(falsas, 'el seed debería traer falsas alarmas').toBeGreaterThan(0);

            await caso(356, 'la torta muestra Activas y Falsas alarmas con cantidad y porcentaje, y coinciden con las alertas del período', async () => {
                await expect(visible(page.getByText('Activas vs. falsas alarmas', { exact: true }))).toBeVisible();
                const l = await leyendaTorta(page);
                expect(l.activas).toBeTruthy();
                expect(l.falsas).toBeTruthy();
                const total = l.activas.n + l.falsas.n;
                expect(l.activas.pct).toBe(Math.round((l.activas.n / total) * 100));
                expect(l.falsas.pct).toBe(Math.round((l.falsas.n / total) * 100));
                await expect(visible(page.getByText(`${l.activas.pct}%`, { exact: true })).first()).toBeVisible();
                expect(l.activas.n).toBe(activas);
                expect(l.falsas.n).toBe(falsas);
                // La torta se dibuja como un anillo con su leyenda.
                const bloque = visible(page.locator('div')
                    .filter({ has: page.getByText('Activas vs. falsas alarmas', { exact: true }) })
                    .filter({ has: page.locator('svg circle') })
                    .last());
                await expect(bloque.locator('svg').first()).toBeVisible();
                expect(await bloque.locator('svg circle').count()).toBeGreaterThanOrEqual(2);
                await expect(bloque.getByText(/^Activas: \d+/)).toBeVisible();
                await expect(bloque.getByText(/^Falsas alarmas: \d+/)).toBeVisible();
            });

            await caso(358, 'el gráfico de barras muestra la cantidad de alertas por período, con la leyenda Activa y Falsa alarma', async () => {
                const b = bloqueEvolucion(page);
                await expect(b).toBeVisible();
                for (const t of ['Día', 'Semana', 'Mes', 'Activa', 'Falsa alarma']) await expect(b.getByText(t, { exact: true })).toBeVisible();
                const barras = await leerEvolucion(page);
                expect(barras.length).toBe(10);
                for (let m = 1; m <= 10; m++) {
                    const prefijo = `2026-${String(m).padStart(2, '0')}`;
                    const delMes = todas.filter((a) => dia(a).startsWith(prefijo));
                    const barra = barras.find((x) => x.etiqueta === etiquetaMes(`${prefijo}-01`));
                    expect.soft(barra, `falta el mes ${prefijo}`).toBeTruthy();
                    if (!barra) continue;
                    expect.soft(barra.activas, `activas de ${barra.etiqueta}`).toBe(cuenta(delMes, 'ACTIVE'));
                    expect.soft(barra.falsas, `falsas alarmas de ${barra.etiqueta}`).toBe(cuenta(delMes, 'FALSE_POSITIVE'));
                    expect.soft(barra.altoActiva > 0, `barra de activas de ${barra.etiqueta}`).toBe(barra.activas > 0);
                    expect.soft(barra.altoFalsa > 0, `barra de falsas alarmas de ${barra.etiqueta}`).toBe(barra.falsas > 0);
                }
                // La barra más alta ocupa el alto máximo del gráfico y las demás son proporcionales.
                expect(Math.max(...barras.flatMap((x) => [x.altoActiva, x.altoFalsa]))).toBeGreaterThan(50);
            });

            await caso(360, 'cada barra separa las Activas de las Falsas alarmas con colores distintos', async () => {
                const barras = await leerEvolucion(page);
                expect(suma(barras, 'activas')).toBe(activas);
                expect(suma(barras, 'falsas')).toBe(falsas);
                expect(barras.some((x) => x.altoActiva > 0)).toBe(true);
                expect(barras.some((x) => x.altoFalsa > 0)).toBe(true);
                const colores = await coloresBarras(page);
                expect(colores.activas.length).toBeGreaterThan(0);
                expect(colores.falsas.length).toBeGreaterThan(0);
                expect(colores.activas.some((c) => colores.falsas.includes(c)), 'activas y falsas alarmas con el mismo color').toBe(false);
            });

            await caso(357, 'al cambiar el rango de fechas la torta se recalcula con las alertas del rango nuevo', async () => {
                const datos = await generarRango(page, ...CORTO);
                const delRango = enRango(alertas, ...CORTO);
                const l = await leyendaTorta(page);
                expect(l.activas.n).toBe(cuenta(delRango, 'ACTIVE'));
                expect(l.falsas.n).toBe(cuenta(delRango, 'FALSE_POSITIVE'));
                expect(l.activas.n + l.falsas.n).toBeLessThan(activas + falsas);
                expect(datos.summary.periodAlerts.length).toBe(delRango.length);
            });

            await caso(361, 'al cambiar el rango "Evolución de casos" muestra solo los períodos del rango nuevo', async () => {
                const delRango = enRango(alertas, ...CORTO);
                const barras = await leerEvolucion(page);
                expect(barras.map((b) => b.etiqueta)).toEqual(['jul/26', 'ago/26']);
                expect(suma(barras, 'activas')).toBe(cuenta(delRango, 'ACTIVE'));
                expect(suma(barras, 'falsas')).toBe(cuenta(delRango, 'FALSE_POSITIVE'));
            });

            await caso(359, 'tocar Día, Semana y Mes reagrupa el gráfico y solo un botón queda activo', async () => {
                await generarRango(page, '2026-07-01', '2026-10-31');
                const delRango = enRango(alertas, '2026-07-01', '2026-10-31');
                const b = bloqueEvolucion(page);
                const esperado = { Día: /^\d{2}\/\d{2}$/, Semana: /^S\d{2}\/\d{2}$/, Mes: /^[a-z]{3}\/\d{2}$/ };
                const cantidad = {};
                const color = (t) => b.getByText(t, { exact: true }).evaluate((e) => getComputedStyle(e).color);
                for (const [boton, formato] of Object.entries(esperado)) {
                    await b.getByText(boton, { exact: true }).click();
                    const barras = await leerEvolucion(page);
                    expect(barras.length, `barras agrupadas por ${boton}`).toBeGreaterThan(0);
                    expect(barras.every((x) => formato.test(x.etiqueta)), `etiquetas por ${boton}`).toBe(true);
                    expect(suma(barras, 'activas') + suma(barras, 'falsas')).toBe(delRango.length);
                    cantidad[boton] = barras.length;
                    // Solo el botón tocado tiene el color de elegido.
                    const colores = { Día: await color('Día'), Semana: await color('Semana'), Mes: await color('Mes') };
                    const otros = Object.keys(colores).filter((k) => k !== boton);
                    for (const o of otros) expect.soft(colores[o], `${o} no debería verse activo al tocar ${boton}`).not.toBe(colores[boton]);
                }
                expect(cantidad.Día).toBeGreaterThan(cantidad.Semana);
                expect(cantidad.Semana).toBeGreaterThan(cantidad.Mes);
            });
        } finally {
            await context.close();
        }
    });
});

function dia(a) { return String(a.createdAt).slice(0, 10); }
