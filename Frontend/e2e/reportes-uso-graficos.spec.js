const { test, expect } = require('@playwright/test');
const { casoContinuo } = require('./helpers/t17');
const h = require('./helpers/t10');

/** Lo que dibuja el anillo de una sección: porcentaje del centro y textos de la leyenda. */
async function leerAnillo(page, titulo) {
    const sec = h.seccion(page, titulo);
    const texto = await sec.innerText();
    return {
        sec,
        centro: Number(texto.match(/(\d+)%\n/)[1]),
        primero: texto.match(/^(?:Recuperados|Exitosas): (\d+) \((\d+)%\)/m),
        segundo: texto.match(/^(?:No recuperados|Fallidas): (\d+) \((\d+)%\)/m),
    };
}

/** Porcentaje que debe mostrar el anillo para `parte` de `total`. */
const porcentaje = (parte, total) => (total > 0 ? Math.min(100, Math.max(0, Math.round((parte / total) * 100))) : 0);

/** Pares categoría/cantidad de "Objetos más reportados", en el orden en que se muestran. */
async function leerCategorias(page) {
    const lineas = (await h.seccion(page, 'Objetos más reportados').innerText()).split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
    const pares = [];
    for (let i = 0; i + 1 < lineas.length; i += 2) pares.push({ category: lineas[i], count: Number(lineas[i + 1]) });
    return pares;
}

const comoServidor = (uso) => uso.top_categories.map((c) => ({ category: c.category, count: c.count }));

/** Anchos (en px) de las barras de un color y alto dados dentro de una sección, en orden de aparición. */
const anchosDeBarras = (sec, color) => sec.locator('div').evaluateAll((els, c) => els
    .filter((e) => getComputedStyle(e).backgroundColor === c && e.getBoundingClientRect().height === 6)
    .map((e) => e.getBoundingClientRect().width), color);


/** Aprieta "Actualizar reporte": el caso lo pide como paso. */
async function tocarActualizar(page) {
    const boton = page.getByText('Actualizar reporte', { exact: true }).locator('visible=true');
    await expect(boton, 'botón Actualizar reporte').toBeVisible({ timeout: 2000 });
    await boton.click();
}

test.describe('Reportes de uso: gráficos de recuperación', () => {
    test('casos 341, 342, 343 y 344: tasa de recuperación en el reporte de uso @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await h.abrirReportes(browser);
        let x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);

        await casoContinuo(343, 'se muestra un gráfico circular con el porcentaje de recuperados y el resto como no recuperados', async () => {
            const a = await leerAnillo(page, 'Tasa de recuperación');
            await expect(a.sec).toBeVisible();
            expect(a.primero, 'leyenda de recuperados').not.toBeNull();
            expect(a.segundo, 'leyenda de no recuperados').not.toBeNull();
            expect(Number(a.primero[2]) + Number(a.segundo[2])).toBe(100);
            const circulos = a.sec.locator('svg circle');
            expect(await circulos.count()).toBeGreaterThanOrEqual(1);
            const colores = await circulos.evaluateAll((cs) => cs.map((c) => c.getAttribute('stroke')));
            expect(colores).toContain('#e53935');
        });
        await casoContinuo(341, 'el porcentaje de recuperación es devueltos sobre encontrados', async () => {
            const a = await leerAnillo(page, 'Tasa de recuperación');
            const { returned_objects: dev, found_objects: enc } = x.uso;
            expect(a.centro).toBe(porcentaje(dev, enc));
            expect(Number(a.primero[1])).toBe(dev);
            expect(Number(a.segundo[1])).toBe(enc - dev);
            expect(Number(a.primero[2])).toBe(porcentaje(dev, enc));
        });
        await casoContinuo(344, 'la torta muestra devueltos sobre encontrados con su porcentaje', async () => {
            const a = await leerAnillo(page, 'Tasa de recuperación');
            expect(x.uso.found_objects).toBeGreaterThan(0);
            expect(x.uso.returned_objects).toBeGreaterThan(0);
            expect(a.centro).toBeGreaterThan(0);
            expect(Number(a.primero[1])).toBe(x.uso.returned_objects);
            expect(Number(a.primero[1]) + Number(a.segundo[1])).toBe(x.uso.found_objects);
        });
        await casoContinuo(342, 'al cambiar Desde y Hasta y actualizar, tasa, objetos más reportados, tiempo promedio y su evolución se recalculan con el período', async () => {
            await h.cambiarFecha(page, 'Desde', '2026-07-01');
            x = await h.cambiarFecha(page, 'Hasta', '2026-07-31');
            expect(x.pedidoUso.searchParams.get('to')).toBe('2026-07-31');
            const a = await leerAnillo(page, 'Tasa de recuperación');
            expect(Number(a.primero[1])).toBe(x.uso.returned_objects);
            expect(a.centro).toBe(porcentaje(x.uso.returned_objects, x.uso.found_objects));
            expect(await leerCategorias(page)).toEqual(comoServidor(x.uso));
            await expect(h.seccion(page, 'Tiempo promedio de recuperación')).toContainText(h.horas(x.uso.avg_recovery_hours));
            const puntos = x.uso.time_series.filter((p) => p.avg_recovery_hours > 0);
            if (puntos.length) await expect(h.seccion(page, 'Evolución del tiempo de recuperación')).toContainText(`máx: ${h.horas(Math.max(...puntos.map((p) => p.avg_recovery_hours)))}`);
            await tocarActualizar(page);
        });
        await context.close();
    });

    test('casos 345, 346 y 347: objetos más reportados en el reporte de uso @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await h.abrirReportes(browser);
        let x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);

        await casoContinuo(345, 'se muestran barras horizontales por categoría con la cantidad de reportes de cada una', async () => {
            await expect(h.seccion(page, 'Objetos más reportados')).toBeVisible();
            expect(x.uso.top_categories.length).toBeGreaterThan(0);
            expect(await leerCategorias(page)).toEqual(comoServidor(x.uso));
            const anchos = await anchosDeBarras(h.seccion(page, 'Objetos más reportados'), 'rgb(25, 184, 184)');
            expect(anchos.length).toBe(x.uso.top_categories.length);
            expect(anchos[0]).toBeGreaterThan(anchos[anchos.length - 1]);
        });
        await casoContinuo(346, 'los objetos se ordenan de mayor a menor cantidad de reportes', async () => {
            const cantidades = (await leerCategorias(page)).map((c) => c.count);
            expect(cantidades).toEqual([...cantidades].sort((a, b) => b - a));
            expect(new Set(cantidades).size, 'con cantidades distintas el orden se nota').toBeGreaterThan(1);
        });
        await casoContinuo(347, 'tras elegir el rango, Objetos más reportados lista las categorías con barras, la mayor primero', async () => {
            await h.cambiarFecha(page, 'Desde', '2026-06-01');
            x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            const pares = await leerCategorias(page);
            expect(pares.length).toBeGreaterThan(0);
            expect(pares).toEqual(comoServidor(x.uso));
            const anchos = await anchosDeBarras(h.seccion(page, 'Objetos más reportados'), 'rgb(25, 184, 184)');
            expect(anchos).toEqual([...anchos].sort((a, b) => b - a));
            expect(pares[0].count).toBe(Math.max(...pares.map((c) => c.count)));
        });
        await context.close();
    });

    test('casos 348, 349, 350 y 351: tiempo promedio de recuperación en el reporte de uso @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await h.abrirReportes(browser);
        const x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
        const kpi = () => h.seccion(page, 'Tiempo promedio de recuperación');

        await casoContinuo(348, 'el promedio se calcula solo con objetos devueltos, entre hallazgo y devolución', async () => {
            const { avg_recovery_hours: prom, min_recovery_hours: min, max_recovery_hours: max, time_series: serie } = x.uso;
            expect(prom).toBeGreaterThanOrEqual(min);
            expect(prom).toBeLessThanOrEqual(max);
            const conDevoluciones = serie.filter((p) => p.returned_objects > 0 && p.avg_recovery_hours > 0);
            const devueltos = conDevoluciones.reduce((s, p) => s + p.returned_objects, 0);
            const ponderado = conDevoluciones.reduce((s, p) => s + p.avg_recovery_hours * p.returned_objects, 0) / devueltos;
            expect(Math.abs(ponderado - prom), `ponderado ${ponderado} vs promedio ${prom}`).toBeLessThan(24);
            await expect(kpi()).toContainText(h.horas(prom));
        });
        await casoContinuo(349, 'la tarjeta muestra promedio, mínimo y máximo en horas o días', async () => {
            await expect(kpi()).toBeVisible();
            await expect(kpi()).toContainText('Promedio');
            await expect(kpi()).toContainText(`mínimo: ${h.horas(x.uso.min_recovery_hours)}`);
            await expect(kpi()).toContainText(`máximo: ${h.horas(x.uso.max_recovery_hours)}`);
            expect(await kpi().innerText()).toMatch(/(hs|días)/);
        });
        await casoContinuo(350, 'el gráfico de líneas muestra la evolución del tiempo promedio a lo largo del tiempo', async () => {
            const sec = h.seccion(page, 'Evolución del tiempo de recuperación');
            await expect(sec).toBeVisible();
            const puntos = x.uso.time_series.filter((p) => p.avg_recovery_hours > 0);
            await expect(sec).toContainText(`máx: ${h.horas(Math.max(...puntos.map((p) => p.avg_recovery_hours)))}`);
            await expect(sec).toContainText(puntos[0].label);
            await expect(sec).toContainText(puntos[puntos.length - 1].label);
            // Un punto por período con devoluciones, unidos por segmentos.
            const alturas = await sec.locator('div').evaluateAll((els) => els
                .filter((e) => getComputedStyle(e).backgroundColor === 'rgb(124, 77, 255)')
                .map((e) => e.offsetHeight));
            expect(alturas.filter((alto) => alto === 8).length).toBe(puntos.length);
            expect(alturas.filter((alto) => alto === 2).length).toBe(puntos.length - 1);
        });
        await casoContinuo(351, 'tras elegir el rango con Desde y Hasta se muestran Promedio, mínimo y máximo', async () => {
            await h.cambiarFecha(page, 'Desde', '2026-07-01');
            const y = await h.cambiarFecha(page, 'Hasta', '2026-09-30');
            await expect(kpi()).toContainText('Promedio');
            await expect(kpi()).toContainText(h.horas(y.uso.avg_recovery_hours));
            await expect(kpi()).toContainText(`mínimo: ${h.horas(y.uso.min_recovery_hours)}`);
            await expect(kpi()).toContainText(`máximo: ${h.horas(y.uso.max_recovery_hours)}`);
        });
        await context.close();
    });
});
