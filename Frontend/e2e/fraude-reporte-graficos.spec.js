const { test, expect } = require('@playwright/test');
const { caso } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    ADMIN, visible, irAlReporte, generarRango, alertasApi, enRango, leyendaTorta, bloqueEvolucion, leerEvolucion,
    etiquetaMes,
} = require('./helpers/t06');

// Rangos cerrados en el pasado: el seed trae alertas ahí y ningún test las agrega después.
const TODO = ['2026-01-01', '2026-10-31'];
const CORTO = ['2026-07-01', '2026-08-31'];

const cuenta = (alertas, estado) => alertas.filter((a) => a.status === estado).length;
const suma = (barras, campo) => barras.reduce((s, b) => s + b[campo], 0);

test.describe('Reporte de fraude: gráficos', () => {
    test('casos 498 a 508: torta de activas vs. falsas alarmas y gráfico de evolución (administrador) @fraude @reportefraude @paralelo', async ({ browser, request }) => {
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

            await caso(498, 'la sección de activas vs. falsas alarmas muestra ambos tipos de caso', async () => {
                await expect(visible(page.getByText('Activas vs. falsas alarmas', { exact: true }))).toBeVisible();
                const l = await leyendaTorta(page);
                expect(l.activas).toBeTruthy();
                expect(l.falsas).toBeTruthy();
            });

            await caso(499, 'la torta muestra la cantidad y el porcentaje de cada tipo', async () => {
                const l = await leyendaTorta(page);
                const total = l.activas.n + l.falsas.n;
                expect(l.activas.pct).toBe(Math.round((l.activas.n / total) * 100));
                expect(l.falsas.pct).toBe(Math.round((l.falsas.n / total) * 100));
                await expect(visible(page.getByText(`${l.activas.pct}%`, { exact: true })).first()).toBeVisible();
            });

            await caso(500, 'los valores de la torta coinciden con las alertas registradas', async () => {
                const l = await leyendaTorta(page);
                expect(l.activas.n).toBe(activas);
                expect(l.falsas.n).toBe(falsas);
            });

            await caso(502, 'la torta se dibuja como un anillo con su leyenda', async () => {
                const bloque = visible(page.locator('div')
                    .filter({ has: page.getByText('Activas vs. falsas alarmas', { exact: true }) })
                    .filter({ has: page.locator('svg circle') })
                    .last());
                await expect(bloque.locator('svg').first()).toBeVisible();
                expect(await bloque.locator('svg circle').count()).toBeGreaterThanOrEqual(2);
                await expect(bloque.getByText(/^Activas: \d+/)).toBeVisible();
                await expect(bloque.getByText(/^Falsas alarmas: \d+/)).toBeVisible();
                await expect(bloque.getByText('activas', { exact: true })).toBeVisible();
            });

            await caso(503, 'el reporte muestra la sección de evolución de casos', async () => {
                const b = bloqueEvolucion(page);
                await expect(b).toBeVisible();
                for (const t of ['Día', 'Semana', 'Mes', 'Activa', 'Falsa alarma']) await expect(b.getByText(t, { exact: true })).toBeVisible();
            });

            await caso(504, 'el gráfico muestra la cantidad de casos de cada mes', async () => {
                const barras = await leerEvolucion(page);
                expect(barras.length).toBe(10);
                for (let m = 1; m <= 10; m++) {
                    const prefijo = `2026-${String(m).padStart(2, '0')}`;
                    const delMes = todas.filter((a) => dia(a).startsWith(prefijo));
                    const b = barras.find((x) => x.etiqueta === etiquetaMes(`${prefijo}-01`));
                    expect.soft(b, `falta el mes ${prefijo}`).toBeTruthy();
                    if (!b) continue;
                    expect.soft(b.activas, `activas de ${b.etiqueta}`).toBe(cuenta(delMes, 'ACTIVE'));
                    expect.soft(b.falsas, `falsas alarmas de ${b.etiqueta}`).toBe(cuenta(delMes, 'FALSE_POSITIVE'));
                }
            });

            await caso(506, 'el gráfico diferencia los casos activos de las falsas alarmas', async () => {
                const barras = await leerEvolucion(page);
                expect(suma(barras, 'activas')).toBe(activas);
                expect(suma(barras, 'falsas')).toBe(falsas);
                expect(barras.some((b) => b.altoActiva > 0)).toBe(true);
                expect(barras.some((b) => b.altoFalsa > 0)).toBe(true);
                const b = bloqueEvolucion(page);
                await expect(b.getByText('Activa', { exact: true })).toBeVisible();
                await expect(b.getByText('Falsa alarma', { exact: true })).toBeVisible();
            });

            await caso(508, 'el gráfico de barras dibuja una barra por tipo en cada período con casos', async () => {
                const barras = await leerEvolucion(page);
                expect(barras.length).toBeGreaterThan(0);
                for (const b of barras) {
                    expect.soft(b.altoActiva > 0, `barra de activas de ${b.etiqueta}`).toBe(b.activas > 0);
                    expect.soft(b.altoFalsa > 0, `barra de falsas alarmas de ${b.etiqueta}`).toBe(b.falsas > 0);
                }
                // La barra más alta ocupa el alto máximo del gráfico y las demás son proporcionales.
                const maxAlto = Math.max(...barras.flatMap((b) => [b.altoActiva, b.altoFalsa]));
                expect(maxAlto).toBeGreaterThan(50);
            });

            await caso(501, 'al cambiar el rango de fechas la torta se actualiza', async () => {
                const datos = await generarRango(page, ...CORTO);
                const delRango = enRango(alertas, ...CORTO);
                const l = await leyendaTorta(page);
                expect(l.activas.n).toBe(cuenta(delRango, 'ACTIVE'));
                expect(l.falsas.n).toBe(cuenta(delRango, 'FALSE_POSITIVE'));
                expect(l.activas.n + l.falsas.n).toBeLessThan(activas + falsas);
                expect(datos.summary.periodAlerts.length).toBe(delRango.length);
            });

            await caso(507, 'al cambiar el rango de fechas el gráfico de evolución se actualiza', async () => {
                const delRango = enRango(alertas, ...CORTO);
                const barras = await leerEvolucion(page);
                expect(barras.map((b) => b.etiqueta)).toEqual(['jul/26', 'ago/26']);
                expect(suma(barras, 'activas')).toBe(cuenta(delRango, 'ACTIVE'));
                expect(suma(barras, 'falsas')).toBe(cuenta(delRango, 'FALSE_POSITIVE'));
            });

            await caso(505, 'los casos se pueden ver agrupados por día, semana o mes', async () => {
                await generarRango(page, '2026-07-01', '2026-10-31');
                const delRango = enRango(alertas, '2026-07-01', '2026-10-31');
                const b = bloqueEvolucion(page);
                const esperado = { Día: /^\d{2}\/\d{2}$/, Semana: /^S\d{2}\/\d{2}$/, Mes: /^[a-z]{3}\/\d{2}$/ };
                const cantidad = {};
                for (const [boton, formato] of Object.entries(esperado)) {
                    await b.getByText(boton, { exact: true }).click();
                    const barras = await leerEvolucion(page);
                    expect(barras.length, `barras agrupadas por ${boton}`).toBeGreaterThan(0);
                    expect(barras.every((x) => formato.test(x.etiqueta)), `etiquetas por ${boton}`).toBe(true);
                    expect(suma(barras, 'activas') + suma(barras, 'falsas')).toBe(delRango.length);
                    cantidad[boton] = barras.length;
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
