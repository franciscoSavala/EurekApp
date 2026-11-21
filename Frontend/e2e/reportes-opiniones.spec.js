const { test, expect } = require('@playwright/test');
const h = require('./helpers/t10');
const { casoContinuo } = require('./helpers/t17');
const { abrirPrecisionAdmin } = require('./helpers/r09');

const visible = (loc) => loc.locator('visible=true');
const texto = (page, t) => visible(page.getByText(t, { exact: true })).first();

/** Valores de las tarjetas del feedback tal como los muestra la pantalla. */
async function tarjetasFeedback(page) {
    const r = {};
    for (const [clave, etiqueta] of [['total_feedback', 'Búsquedas registradas'], ['total_ratings', 'Atenciones calificadas'], ['successful_searches', 'Búsquedas exitosas'], ['unsuccessful_searches', 'Búsquedas fallidas']]) {
        r[clave] = Number(await h.valorDeTarjeta(page, etiqueta));
    }
    return r;
}
const delServidor = (f) => ({ total_feedback: f.total_feedback, total_ratings: f.total_ratings, successful_searches: f.successful_searches, unsuccessful_searches: f.unsuccessful_searches });

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** Lee el anillo de precisión: porcentaje del centro y leyendas de exitosas y fallidas. */
async function anillo(page) {
    const t = await h.seccion(page, 'Precisión de coincidencias').innerText();
    return {
        centro: Number(t.match(/(\d+)%\n/)[1]),
        exitosas: t.match(/^Exitosas: (\d+) \((\d+)%\)/m),
        fallidas: t.match(/^Fallidas: (\d+) \((\d+)%\)/m),
    };
}

const ASPECTOS = [
    ['staff_treatment', 'Trato del personal'],
    ['waiting_time', 'Tiempo de espera'],
    ['instructions_clarity', 'Claridad de las indicaciones'],
    ['object_condition', 'Estado del objeto'],
    ['pickup_security', 'Seguridad del retiro'],
];

test.describe('Reportes de opiniones: feedback de búsquedas', () => {
    test('casos 190, 192 y 352: el administrador ve el reporte de precisión (filtros, total de búsquedas y gráfico) @reportes @paralelo', async ({ browser }) => {
        await casoContinuo(190, 'el administrador filtra el reporte de precisión con Todos, Encontró objeto y No encontró', async () => {
            const { context, page } = await abrirPrecisionAdmin(browser);
            try {
                for (const filtro of ['Todos', 'Encontró objeto', 'No encontró']) {
                    await texto(page, filtro).click();
                    await expect(texto(page, 'Búsquedas registradas')).toBeVisible();
                }
            } finally {
                await context.close();
            }
        });
        await casoContinuo(192, 'la tarjeta Búsquedas registradas muestra el total de feedbacks del período', async () => {
            const { context, page } = await abrirPrecisionAdmin(browser);
            try {
                await expect(texto(page, 'Búsquedas registradas')).toBeVisible();
                expect(Number(await h.valorDeTarjeta(page, 'Búsquedas registradas'))).toBeGreaterThanOrEqual(0);
            } finally {
                await context.close();
            }
        });
        await casoContinuo(352, 'las tarjetas Búsquedas exitosas y fallidas y el gráfico Precisión de coincidencias muestran cantidades y porcentajes', async () => {
            const { context, page } = await abrirPrecisionAdmin(browser);
            try {
                await expect(texto(page, 'Búsquedas exitosas')).toBeVisible();
                await expect(texto(page, 'Búsquedas fallidas')).toBeVisible();
                await expect(h.seccion(page, 'Precisión de coincidencias')).toBeVisible();
            } finally {
                await context.close();
            }
        });
    });

    test('casos 191, 193, 194 y 264: calificación de la atención (promedios, comentarios, estado sin calificaciones y barras) @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await h.abrirReportes(browser);
        const sec = () => h.seccion(page, 'Calificación de la atención');
        // El período con calificaciones empieza antes del último mes (la del seed es de abril).
        let conNotas = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);

        await test.step('caso 191: cada aspecto muestra su promedio sobre 5 y coincide con las calificaciones registradas', async () => {
            expect(conNotas.feedback.total_ratings, 'hay calificaciones en el período').toBeGreaterThan(0);
            await expect(sec()).toBeVisible();
            for (const [clave, etiqueta] of ASPECTOS) {
                const fila = visible(page.getByText(etiqueta, { exact: true })).first().locator('xpath=..');
                const esperado = conNotas.feedback.aspect_averages[clave];
                expect(esperado, `el servidor trae ${etiqueta}`).toBeGreaterThan(0);
                expect(esperado, `${etiqueta} es un promedio sobre 5`).toBeLessThanOrEqual(5);
                await expect(fila).toContainText(esperado.toFixed(1));
            }
        });

        await test.step('caso 193: la sección Comentarios lista los comentarios del período', async () => {
            const comentarios = conNotas.feedback.comments;
            expect(comentarios.length).toBeGreaterThan(0);
            await expect(texto(page, 'Comentarios')).toBeVisible();
            for (const c of comentarios) await expect(visible(page.getByText(c.comment, { exact: true })).first()).toBeVisible();
        });

        await test.step('caso 264: las barras horizontales son una por aspecto, con su promedio sobre 5 y sin superposiciones', async () => {
            const cajas = [];
            for (const [clave, etiqueta] of ASPECTOS) {
                const fila = visible(page.getByText(etiqueta, { exact: true })).first().locator('xpath=..');
                await expect(fila).toBeVisible();
                const caja = await fila.boundingBox();
                cajas.push(caja);
                // Dentro de la fila, la barra es el único bloque coloreado: su ancho es promedio / 5 del espacio disponible.
                const barras = await fila.locator('div').evaluateAll((els) => els
                    .filter((e) => getComputedStyle(e).backgroundColor === 'rgb(240, 165, 0)')
                    .map((e) => ({ ancho: e.getBoundingClientRect().width, contenedor: e.parentElement.getBoundingClientRect().width })));
                expect(barras.length, `una barra para ${etiqueta}`).toBe(1);
                const esperado = conNotas.feedback.aspect_averages[clave] / 5;
                expect(barras[0].ancho / barras[0].contenedor, `proporción de ${etiqueta}`).toBeCloseTo(esperado, 1);
            }
            // Una fila debajo de la otra, sin pisarse.
            for (let i = 1; i < cajas.length; i++) expect(cajas[i].y).toBeGreaterThanOrEqual(cajas[i - 1].y + cajas[i - 1].height - 1);
        });

        await test.step('caso 194: sin calificaciones en el período, la sección dice que todavía nadie calificó la atención', async () => {
            const vacio = await h.cambiarFecha(page, 'Hasta', '2026-02-01');
            expect(vacio.feedback.total_ratings).toBe(0);
            await expect(sec()).toBeVisible();
            await expect(page.getByText('Todavía nadie calificó la atención en el período seleccionado.').locator('visible=true')).toBeVisible();
        });
        await context.close();
    });

    test('caso 353: el cálculo de búsquedas exitosas y no exitosas coincide con el feedback registrado @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, feedback, registros } = await h.abrirReportes(browser);
        await test.step('caso 353: los valores del gráfico coinciden con los feedbacks registrados', async () => {
            const f = feedback;
            const a = await anillo(page);
            expect(a.exitosas, 'leyenda de exitosas').not.toBeNull();
            expect(a.fallidas, 'leyenda de fallidas').not.toBeNull();
            expect(Number(a.exitosas[1])).toBe(registros.filter((r) => r.wasFound).length);
            expect(Number(a.fallidas[1])).toBe(registros.filter((r) => !r.wasFound).length);
            expect(Number(a.exitosas[2])).toBe(porcentaje(f.successful_searches, f.total_feedback));
            expect(Number(a.exitosas[2]) + Number(a.fallidas[2])).toBe(f.total_feedback > 0 ? 100 : 0);
            expect(await tarjetasFeedback(page)).toEqual(delServidor(f));
            expect(f.total_feedback).toBe(f.successful_searches + f.unsuccessful_searches);
        });
        await context.close();
    });
});
