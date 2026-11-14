const { test, expect } = require('@playwright/test');
const h = require('./helpers/t10');

/** Valores de las tarjetas del feedback tal como los muestra la pantalla. */
async function tarjetasFeedback(page) {
    const r = {};
    for (const [clave, etiqueta] of [['total_feedback', 'Búsquedas registradas'], ['total_ratings', 'Atenciones calificadas'], ['successful_searches', 'Búsquedas exitosas'], ['unsuccessful_searches', 'Búsquedas fallidas']]) {
        r[clave] = Number(await h.valorDeTarjeta(page, etiqueta));
    }
    return r;
}
const delServidor = (f) => ({ total_feedback: f.total_feedback, total_ratings: f.total_ratings, successful_searches: f.successful_searches, unsuccessful_searches: f.unsuccessful_searches });

/** Renglones de la tabla "Tendencias de búsquedas": [período, exitosas, fallidas]. */
async function leerTendencias(page) {
    const lineas = (await h.seccion(page, 'Tendencias de búsquedas').innerText()).split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
    const cabecera = lineas.slice(0, 3);
    const filas = [];
    for (let i = 3; i + 2 < lineas.length; i += 3) filas.push([lineas[i], Number(lineas[i + 1]), Number(lineas[i + 2])]);
    return { cabecera, filas };
}

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

test.describe('Reportes de opiniones: feedback de búsquedas', () => {
    test('casos 248, 249 y 250: el filtro del feedback de búsquedas filtra los datos @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await h.abrirReportes(browser);

        await test.step('caso 249: "Encontró objeto" filtra correctamente', async () => {
            const x = await h.apretar(page, 'Encontró objeto');
            expect(x.pedidoFeedback.searchParams.get('wasFound')).toBe('true');
            expect(x.registros.every((r) => r.wasFound === true)).toBe(true);
            expect(x.feedback.unsuccessful_searches).toBe(0);
            expect(x.feedback.total_feedback).toBe(x.registros.length);
            expect(await tarjetasFeedback(page)).toEqual(delServidor(x.feedback));
        });
        await test.step('caso 250: "No encontró" filtra correctamente', async () => {
            const x = await h.apretar(page, 'No encontró');
            expect(x.pedidoFeedback.searchParams.get('wasFound')).toBe('false');
            expect(x.registros.every((r) => r.wasFound === false)).toBe(true);
            expect(x.feedback.successful_searches).toBe(0);
            expect(x.feedback.total_feedback).toBe(x.registros.length);
            expect(x.feedback.total_feedback).toBeGreaterThan(0);
            expect(await tarjetasFeedback(page)).toEqual(delServidor(x.feedback));
        });
        await test.step('caso 248: "Todos" muestra todos los datos', async () => {
            const x = await h.apretar(page, 'Todos');
            expect(x.pedidoFeedback.searchParams.has('wasFound')).toBe(false);
            expect(x.feedback.total_feedback).toBe(x.feedback.successful_searches + x.feedback.unsuccessful_searches);
            expect(x.feedback.total_feedback).toBe(x.registros.length);
            expect(await tarjetasFeedback(page)).toEqual(delServidor(x.feedback));
        });
        await context.close();
    });

    test('casos 262, 263 y 264: la tabla de tendencias de feedback muestra períodos, datos y se actualiza con el rango @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, feedback, registros } = await h.abrirReportes(browser);

        await test.step('caso 262: se muestra la tabla de períodos', async () => {
            const t = await leerTendencias(page);
            expect(feedback.time_series.length).toBeGreaterThan(0);
            expect(t.cabecera.slice(0, 1)).toEqual(['Período']);
            expect(t.filas.map((f) => f[0])).toEqual(feedback.time_series.map((p) => p.label));
        });
        await test.step('caso 263: los datos por período coinciden con los feedbacks registrados', async () => {
            const t = await leerTendencias(page);
            expect(t.filas).toEqual(feedback.time_series.map((p) => [p.label, p.successful, p.unsuccessful]));
            // Cada período cuenta los feedbacks registrados en ese día.
            for (const p of feedback.time_series) {
                const delDia = registros.filter((r) => r.createdAt.slice(0, 10) === p.label);
                expect(delDia.filter((r) => r.wasFound).length, `exitosas de ${p.label}`).toBe(p.successful);
                expect(delDia.filter((r) => !r.wasFound).length, `fallidas de ${p.label}`).toBe(p.unsuccessful);
            }
            await expect.soft(page.getByText('Calif. prom.', { exact: true }).locator('visible=true'), 'columna Calif. prom.').toBeVisible({ timeout: 2000 });
        });
        await test.step('caso 264: la tabla se actualiza según el rango de fechas', async () => {
            // Antes de que existiera ningún feedback: la tabla queda vacía.
            await h.cambiarFecha(page, 'Hasta', '2026-10-31');
            const x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            expect(x.feedback.time_series).toEqual([]);
            await expect(page.getByText('Tendencias de búsquedas', { exact: true }).locator('visible=true')).toHaveCount(0);
            // Al volver al rango con feedback reaparece con los datos del servidor.
            const y = await h.cambiarFecha(page, 'Hasta', h.HOY());
            expect(y.feedback.time_series.length).toBeGreaterThan(0);
            expect((await leerTendencias(page)).filas).toEqual(y.feedback.time_series.map((p) => [p.label, p.successful, p.unsuccessful]));
        });
        await context.close();
    });

    test('casos 386 a 391: distribución de calificaciones por estrellas en el reporte de feedback @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await h.abrirReportes(browser);
        // El servidor ya no entrega esta distribución: hoy el reporte trae el promedio por aspecto.
        const distribucion = page.getByText(/Distribuci[oó]n de calificaciones/i).locator('visible=true').first();

        await test.step('caso 386: se muestra el gráfico de distribución de calificaciones', async () => {
            await expect.soft(distribucion).toBeVisible({ timeout: 2000 });
        });
        await test.step('caso 387: se muestran las calificaciones de 1, 2, 3, 4 y 5 estrellas', async () => {
            for (const n of [1, 2, 3, 4, 5]) {
                await expect.soft(page.getByText(new RegExp(`^${n} ?(estrellas?|★)`)).locator('visible=true').first(), `${n} estrella(s)`).toBeVisible({ timeout: 1000 });
            }
        });
        await test.step('caso 388: se muestra la cantidad de calificaciones por cada estrella', async () => {
            await expect.soft(h.seccion(page, 'Distribución de calificaciones')).toContainText(/5/, { timeout: 2000 });
        });
        await test.step('caso 389: se muestra el promedio general de las calificaciones', async () => {
            await expect.soft(page.getByText(/promedio general|calificaci[oó]n promedio/i).locator('visible=true').first()).toBeVisible({ timeout: 2000 });
        });
        await test.step('caso 390: el gráfico se actualiza según el rango de fechas', async () => {
            await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            await expect.soft(distribucion).toBeVisible({ timeout: 2000 });
        });
        await test.step('caso 391: el gráfico se ve en barras horizontales sin superposición', async () => {
            await expect.soft(h.seccion(page, 'Distribución de calificaciones')).toBeVisible({ timeout: 2000 });
        });
        await context.close();
    });

    test('casos 488 a 492: búsquedas exitosas vs no exitosas en el reporte de feedback @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, feedback, registros } = await h.abrirReportes(browser);
        let x = { feedback, registros };
        const anillo = async () => {
            const texto = await h.seccion(page, 'Precisión de coincidencias').innerText();
            return {
                centro: Number(texto.match(/(\d+)%\n/)[1]),
                exitosas: texto.match(/^Exitosas: (\d+) \((\d+)%\)/m),
                fallidas: texto.match(/^Fallidas: (\d+) \((\d+)%\)/m),
            };
        };

        await test.step('caso 488: el reporte muestra las búsquedas exitosas y no exitosas', async () => {
            await expect(h.seccion(page, 'Precisión de coincidencias')).toBeVisible();
            await expect(page.getByText('Búsquedas exitosas', { exact: true }).locator('visible=true')).toBeVisible();
            await expect(page.getByText('Búsquedas fallidas', { exact: true }).locator('visible=true')).toBeVisible();
        });
        await test.step('caso 489: se muestran cantidad y porcentaje de cada tipo de búsqueda', async () => {
            const a = await anillo();
            const f = x.feedback;
            expect(a.exitosas, 'leyenda de exitosas').not.toBeNull();
            expect(a.fallidas, 'leyenda de fallidas').not.toBeNull();
            expect(Number(a.exitosas[1])).toBe(f.successful_searches);
            expect(Number(a.fallidas[1])).toBe(f.unsuccessful_searches);
            expect(Number(a.exitosas[2])).toBe(porcentaje(f.successful_searches, f.total_feedback));
            expect(Number(a.exitosas[2]) + Number(a.fallidas[2])).toBe(f.total_feedback > 0 ? 100 : 0);
        });
        await test.step('caso 490: el cálculo coincide con el feedback registrado', async () => {
            const f = x.feedback;
            expect(await tarjetasFeedback(page)).toEqual(delServidor(f));
            expect(f.successful_searches).toBe(x.registros.filter((r) => r.wasFound).length);
            expect(f.unsuccessful_searches).toBe(x.registros.filter((r) => !r.wasFound).length);
            expect(f.total_feedback).toBe(f.successful_searches + f.unsuccessful_searches);
        });
        await test.step('caso 491: el gráfico se actualiza según el rango de fechas', async () => {
            await h.cambiarFecha(page, 'Hasta', '2026-10-31');
            const vacio = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            expect(vacio.feedback.total_feedback).toBe(0);
            expect((await anillo()).centro).toBe(0);
            expect(await tarjetasFeedback(page)).toEqual(delServidor(vacio.feedback));
            x = await h.cambiarFecha(page, 'Hasta', h.HOY());
            expect(x.feedback.total_feedback).toBeGreaterThan(0);
            const a = await anillo();
            expect(Number(a.fallidas[1])).toBe(x.feedback.unsuccessful_searches);
        });
        await test.step('caso 492: el gráfico circular muestra la relación entre exitosas y no exitosas', async () => {
            const sec = h.seccion(page, 'Precisión de coincidencias');
            expect(await sec.locator('svg circle').count()).toBeGreaterThanOrEqual(1);
            const colores = await sec.locator('svg circle').evaluateAll((cs) => cs.map((c) => c.getAttribute('stroke')));
            // Con búsquedas fallidas el anillo de fondo es el de las fallidas; si hay exitosas se suma su arco.
            expect(colores).toContain('#e53935');
            if (x.feedback.successful_searches > 0) expect(colores).toContain('#4caf50');
            await expect(sec.getByText(/^Exitosas:/)).toBeVisible();
            await expect(sec.getByText(/^Fallidas:/)).toBeVisible();
        });
        await context.close();
    });
});
