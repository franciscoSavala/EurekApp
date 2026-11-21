// Reporte de feedback de usabilidad de la app, visto por el administrador (casos 266 a 268).
const { test, expect } = require('@playwright/test');
const { USUARIOS, irAlMenu } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { casoContinuo } = require('./helpers/t17');

const visible = (loc) => loc.locator('visible=true');
const texto = (page, t) => visible(page.getByText(t, { exact: true })).first();

async function abrirUsabilidad(browser) {
    const { context, page } = await abrirComo(browser, USUARIOS.admin);
    const carga = page.waitForResponse((r) => r.url().includes('/usability-feedback/report') && r.request().method() === 'GET');
    await irAlMenu(page, 'Opiniones sobre la app');
    const reporte = await (await carga).json();
    await expect(texto(page, 'Actualizar reporte')).toBeVisible();
    return { context, page, reporte };
}

/** Escribe una fecha en "Desde" o "Hasta". */
async function ponerFecha(page, etiqueta, fecha) {
    await visible(page.getByText(etiqueta, { exact: true })).first().locator('xpath=following-sibling::*[1]').click();
    const campo = page.locator('input[type="date"]');
    await campo.fill(fecha);
    await campo.press('Enter');
}

test.describe('Reporte de usabilidad del administrador', () => {
    test('casos 266 y 267: calificación promedio, total, distribución por estrella, aspectos y evolución temporal @reportes @paralelo', async ({ browser }) => {
        const { context, page, reporte } = await abrirUsabilidad(browser);
        try {
            await casoContinuo(266, 'se ven la calificación promedio, el total de feedbacks y la distribución por estrella con su cantidad', async () => {
                expect(reporte.total_feedback, 'hay opiniones sobre la app en el período').toBeGreaterThan(0);
                await expect(texto(page, 'Calificación promedio')).toBeVisible();
                await expect(texto(page, 'Total de feedbacks')).toBeVisible();
                await expect(texto(page, String(reporte.total_feedback))).toBeVisible();
                await expect(texto(page, reporte.average_rating.toFixed(1))).toBeVisible();
                await expect(texto(page, 'Distribución de calificaciones')).toBeVisible();
                for (const n of [1, 2, 3, 4, 5]) {
                    await expect(visible(page.getByText('★'.repeat(n), { exact: true })).first(), `fila de ${n} estrellas`).toBeVisible();
                }
                const suma = Object.values(reporte.star_distribution).reduce((a, b) => a + b, 0);
                expect(suma).toBe(reporte.total_feedback);
            });

            await casoContinuo(267, 'se ven los aspectos más seleccionados y la evolución temporal, agrupable por Día, Semana o Mes', async () => {
                await expect(texto(page, 'Aspectos más seleccionados')).toBeVisible();
                for (const etiqueta of Object.keys(reporte.aspect_distribution).map((k) => ({ FACILIDAD_USO: 'Facilidad de uso', CLARIDAD: 'Claridad de interfaz', TIEMPO_RESPUESTA: 'Tiempo de respuesta', NAVEGACION: 'Navegación' })[k])) {
                    await expect(texto(page, etiqueta), etiqueta).toBeVisible();
                }
                await expect(texto(page, 'Evolución temporal')).toBeVisible();
                await expect(texto(page, 'Agrupar por:')).toBeVisible();
                for (const [boton, grupo] of [['Semana', 'WEEK'], ['Mes', 'MONTH'], ['Día', 'DAY']]) {
                    const respuesta = page.waitForResponse((r) => r.url().includes('/usability-feedback/report') && r.url().includes(`groupBy=${grupo}`));
                    await texto(page, boton).click();
                    const nuevo = await (await respuesta).json();
                    expect(nuevo.time_series.length, `evolución agrupada por ${boton}`).toBeGreaterThan(0);
                    await expect(texto(page, nuevo.time_series[0].label)).toBeVisible();
                }
            });
        } finally {
            await context.close();
        }
    });

    test('caso 268: un período sin opiniones muestra el aviso de que no hay feedback de usabilidad @reportes @paralelo', async ({ browser }) => {
        const { context, page } = await abrirUsabilidad(browser);
        try {
            await test.step('caso 268: aparece "Sin feedback de usabilidad para el período seleccionado."', async () => {
                await ponerFecha(page, 'Hasta', '2020-02-01');
                await ponerFecha(page, 'Desde', '2020-01-01');
                const respuesta = page.waitForResponse((r) => r.url().includes('/usability-feedback/report') && r.request().method() === 'GET');
                await texto(page, 'Actualizar reporte').click();
                expect((await (await respuesta).json()).total_feedback).toBe(0);
                await expect(visible(page.getByText('Sin feedback de usabilidad para el período seleccionado.'))).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
