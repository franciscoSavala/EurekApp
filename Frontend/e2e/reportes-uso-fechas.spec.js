const { test, expect } = require('@playwright/test');
const { casoContinuo } = require('./helpers/t17');
const h = require('./helpers/t10');
const r8 = require('./helpers/r08');

/** Valores de las cuatro tarjetas de arriba, tal como los muestra la pantalla. */
async function tarjetas(page) {
    const r = {};
    for (const [clave, etiqueta] of [['found_objects', 'Objetos encontrados'], ['lost_objects', 'Búsquedas / perdidos'], ['returned_objects', 'Objetos devueltos'], ['active_users', 'Usuarios activos']]) {
        r[clave] = Number(await h.valorDeTarjeta(page, etiqueta));
    }
    return r;
}
const esperadas = (uso) => ({ found_objects: uso.found_objects, lost_objects: uso.lost_objects, returned_objects: uso.returned_objects, active_users: uso.active_users });

test.describe('Reportes: filtros de fecha y agrupación', () => {
    test('casos 180 y 181: el filtro desde/hasta actualiza los datos y no admite fechas invertidas @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, uso: inicial } = await h.abrirReportes(browser);

        await casoContinuo(180, 'con un Desde y un Hasta válidos, y al cambiar una fecha, las tarjetas y Tendencias se actualizan', async () => {
            const x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            expect(x.pedidoUso.searchParams.get('from')).toBe(h.DESDE_AMPLIO);
            await expect(page.getByText(h.DESDE_AMPLIO, { exact: true }).locator('visible=true')).toBeVisible();
            expect(await tarjetas(page)).toEqual(esperadas(x.uso));
            // El rango amplio incluye objetos de meses anteriores que los últimos 30 días no tenían.
            expect(x.uso.found_objects).toBeGreaterThanOrEqual(inicial.found_objects);
            expect(x.uso.time_series.length).toBeGreaterThan(0);
            for (const p of x.uso.time_series) await expect(h.seccion(page, 'Tendencias')).toContainText(p.label);

            // Se cambia una de las fechas: todo vuelve a calcularse.
            await h.cambiarFecha(page, 'Desde', '2026-07-01');
            const julio = await h.cambiarFecha(page, 'Hasta', '2026-07-31');
            expect(julio.pedidoUso.searchParams.get('to')).toBe('2026-07-31');
            expect(await tarjetas(page)).toEqual(esperadas(julio.uso));
            for (const p of julio.uso.time_series) await expect(h.seccion(page, 'Tendencias')).toContainText(p.label);
            await h.cambiarFecha(page, 'Desde', '2026-08-01');
            const agosto = await h.cambiarFecha(page, 'Hasta', '2026-08-31');
            expect(agosto.pedidoUso.searchParams.get('from')).toBe('2026-08-01');
            expect(await tarjetas(page)).toEqual(esperadas(agosto.uso));
            for (const p of agosto.uso.time_series) await expect(h.seccion(page, 'Tendencias')).toContainText(p.label);
            // Meses distintos, movimiento distinto.
            expect(esperadas(agosto.uso)).not.toEqual(esperadas(julio.uso));
        });

        await casoContinuo(181, 'con "desde" mayor a "hasta" se muestra un error o no se permite', async () => {
            await h.cambiarFecha(page, 'Hasta', h.HOY());
            const futuro = `${Number(h.HOY().slice(0, 4)) + 1}-01-01`;
            await h.cambiarFecha(page, 'Desde', futuro);
            const aceptada = await page.getByText(futuro, { exact: true }).locator('visible=true').count() > 0;
            const hayError = await page.getByText(/error|inv[aá]lid|mayor|anterior|no puede|incorrect/i).locator('visible=true').count() > 0;
            expect(aceptada && !hayError, 'la pantalla aceptó una fecha "desde" posterior a "hasta" sin avisar y mostró el reporte vacío').toBe(false);
        });
        await context.close();
    });

    test('caso 182: el reporte de usabilidad recalcula promedio, distribución y evolución al cambiar el período @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page } = await r8.abrirUsabilidad(browser);
        await casoContinuo(182, 'al cambiar el período y actualizar, promedio, distribución y evolución se recalculan', async () => {
            const total = async () => Number(await h.valorDeTarjeta(page, 'Total de feedbacks'));
            // Período amplio, con todas las opiniones registradas.
            await r8.escribirFecha(page, 'Desde', h.DESDE_AMPLIO);
            await r8.escribirFecha(page, 'Hasta', h.HOY());
            const amplio = await r8.actualizarUsabilidad(page);
            expect(amplio.url.searchParams.get('from')).toBe(h.DESDE_AMPLIO);
            const a = amplio.cuerpo;
            expect(a.total_feedback, 'hay opiniones en el período amplio').toBeGreaterThan(0);
            expect(await total()).toBe(a.total_feedback);
            await expect(page.getByText('Calificación promedio', { exact: true }).locator('visible=true')).toBeVisible();
            await expect(h.seccion(page, 'Distribución de calificaciones')).toBeVisible();
            for (const p of a.time_series) await expect(h.seccion(page, 'Evolución temporal')).toContainText(p.label);

            // Un período sin opiniones: todo queda recalculado a ese período.
            await r8.escribirFecha(page, 'Desde', '2020-01-01');
            await r8.escribirFecha(page, 'Hasta', '2020-01-31');
            const vacio = await r8.actualizarUsabilidad(page);
            expect(vacio.url.searchParams.get('to')).toBe('2020-01-31');
            expect(vacio.cuerpo.total_feedback).toBe(0);
            await expect(page.getByText('Sin feedback de usabilidad para el período seleccionado.').locator('visible=true')).toBeVisible();
            expect(await total(), 'total de feedbacks del período vacío').toBe(0);
            await expect(page.getByText('0.0', { exact: true }).locator('visible=true').first(), 'calificación promedio en cero').toBeVisible();
            await expect(page.getByText('Evolución temporal', { exact: true }).locator('visible=true')).toHaveCount(0);

            // Un período que termina antes de hoy: los números son los que devuelve el servidor para ese período.
            await r8.escribirFecha(page, 'Desde', h.DESDE_AMPLIO);
            await r8.escribirFecha(page, 'Hasta', '2026-11-01');
            const parcial = await r8.actualizarUsabilidad(page);
            const p = parcial.cuerpo;
            expect(p.total_feedback).toBeLessThanOrEqual(a.total_feedback);
            if (p.total_feedback > 0) {
                expect(await total()).toBe(p.total_feedback);
                for (const pt of p.time_series) await expect(h.seccion(page, 'Evolución temporal')).toContainText(pt.label);
            }
        });
        await context.close();
    });

    test('casos 183 y 184: la agrupación por día, semana y mes se activa, es excluyente y cambia las tablas de tendencias @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, pedidoUso } = await h.abrirReportes(browser);
        expect(pedidoUso.searchParams.get('groupBy')).toBe('DAY');
        await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);

        const soloActivo = async (texto) => {
            for (const t of ['Día', 'Semana', 'Mes']) {
                expect(await h.fondoDe(page, t), `${t} con ${texto} activo`).toBe(t === texto ? h.ACTIVO : 'rgb(240, 244, 244)');
            }
        };
        const porAgrupacion = {};

        await casoContinuo(183, 'Día, Semana y Mes se activan al tocarlos, el anterior se desactiva y Tendencias cambia de período', async () => {
            const periodos = [];
            for (const [boton, grupo] of [['Semana', 'WEEK'], ['Mes', 'MONTH'], ['Día', 'DAY']]) {
                const x = await h.apretar(page, boton);
                expect(x.pedidoUso.searchParams.get('groupBy')).toBe(grupo);
                await soloActivo(boton);
                for (const p of x.uso.time_series) await expect(h.seccion(page, 'Tendencias')).toContainText(p.label);
                porAgrupacion[grupo] = x;
                periodos.push(x.uso.time_series.map((p) => p.label).join('|'));
            }
            // Cada agrupación dibuja períodos distintos.
            expect(new Set(periodos).size).toBe(3);
            // Al ir y venir solo queda una seleccionada.
            for (const t of ['Mes', 'Día', 'Semana']) {
                await h.apretar(page, t);
                await soloActivo(t);
            }
        });

        await casoContinuo(184, 'las tablas de tendencias agrupan por el período elegido', async () => {
            const formato = { DAY: /^\d{4}-\d{2}-\d{2}$/, MONTH: /^\d{4}-\d{2}$/ };
            for (const [grupo, x] of Object.entries(porAgrupacion)) {
                expect(x.uso.time_series.length, `períodos de ${grupo}`).toBeGreaterThan(0);
                if (formato[grupo]) for (const p of x.uso.time_series) expect(p.label).toMatch(formato[grupo]);
                // El total no cambia con la agrupación: solo cómo se reparte entre períodos.
                const suma = x.uso.time_series.reduce((s, p) => s + p.found_objects, 0);
                expect(suma, `encontrados sumados por ${grupo}`).toBe(x.uso.found_objects);
            }
            const m = await h.apretar(page, 'Mes');
            for (const p of m.feedback.time_series || []) await expect(page.locator('body')).toContainText(p.label);
        });
        await context.close();
    });
});
