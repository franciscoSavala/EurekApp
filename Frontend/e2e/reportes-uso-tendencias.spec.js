const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario } = require('./helpers');
const { casoContinuo } = require('./helpers/t17');
const h = require('./helpers/t10');
const r8 = require('./helpers/r08');

/** Renglones de la tabla "Tendencias de búsquedas": cabecera y [período, exitosas, fallidas]. */
async function leerTendencias(page) {
    const lineas = (await h.seccion(page, 'Tendencias de búsquedas').innerText()).split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
    const filas = [];
    for (let i = 3; i + 2 < lineas.length; i += 3) filas.push([lineas[i], Number(lineas[i + 1]), Number(lineas[i + 2])]);
    return { cabecera: lineas.slice(0, 3), filas };
}

test.describe('Reportes: tendencias de búsquedas (reporte de precisión)', () => {
    test('casos 198, 199 y 200: el administrador ve la tabla de tendencias de búsquedas, sus datos por período y cómo cambia con los filtros @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.admin);
        const alRegistrar = () => r8.esperarJson(page, '/feedback/records?');

        await casoContinuo(198, 'se muestra una tabla con las columnas Período, Exitosas y Fallidas, una fila por período', async () => {
            await r8.abrirPrecision(page);
            await r8.escribirFecha(page, 'Desde', h.DESDE_AMPLIO);
            const t = await leerTendencias(page);
            expect(t.cabecera).toEqual(['Período', 'Exitosas', 'Fallidas']);
            expect(t.filas.length).toBeGreaterThan(0);
        });

        await casoContinuo(199, 'Exitosas y Fallidas de cada período coinciden con los feedbacks y con el filtro Todos, Encontró objeto o No encontró', async () => {
            await r8.abrirPrecision(page);
            await r8.escribirFecha(page, 'Desde', h.DESDE_AMPLIO);
            for (const [boton, valor] of [['Todos', null], ['Encontró objeto', true], ['No encontró', false]]) {
                const pedido = alRegistrar();
                await page.getByText(boton, { exact: true }).locator('visible=true').click();
                const { cuerpo: registros } = await pedido;
                await page.waitForTimeout(500);
                const t = await leerTendencias(page);
                const dias = new Set(registros.map((r) => r.createdAt.slice(0, 10)));
                for (const [periodo, exitosas, fallidas] of t.filas) {
                    const delDia = registros.filter((r) => r.createdAt.slice(0, 10) === periodo);
                    expect(exitosas, `exitosas de ${periodo} con ${boton}`).toBe(delDia.filter((r) => r.wasFound).length);
                    expect(fallidas, `fallidas de ${periodo} con ${boton}`).toBe(delDia.filter((r) => !r.wasFound).length);
                    if (valor !== null) expect(valor ? fallidas : exitosas).toBe(0);
                }
                expect(t.filas.length, `períodos con ${boton}`).toBe(dias.size);
            }
        });

        await casoContinuo(200, 'al modificar el rango de fechas la tabla se actualiza según el rango', async () => {
            await r8.abrirPrecision(page);
            await r8.escribirFecha(page, 'Desde', h.DESDE_AMPLIO);
            const amplia = (await leerTendencias(page)).filas;
            expect(amplia.length).toBeGreaterThan(0);
            // Un rango sin feedbacks: la tabla desaparece o queda sin filas.
            await r8.escribirFecha(page, 'Desde', '2020-01-01');
            await r8.escribirFecha(page, 'Hasta', '2020-01-31');
            await page.waitForTimeout(1000);
            await expect(page.getByText('Tendencias de búsquedas', { exact: true }).locator('visible=true')).toHaveCount(0);
            // Al volver al rango amplio, vuelven las filas.
            await r8.escribirFecha(page, 'Desde', h.DESDE_AMPLIO);
            await r8.escribirFecha(page, 'Hasta', h.HOY());
            await page.waitForTimeout(1000);
            expect((await leerTendencias(page)).filas).toEqual(amplia);
        });
        await context.close();
    });
});
