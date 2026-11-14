const { test, expect } = require('@playwright/test');
const h = require('./helpers/t10');

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
    test('casos 237, 238 y 239: el filtro desde/hasta actualiza los datos y no admite fechas invertidas @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, uso: inicial } = await h.abrirReportes(browser);

        await test.step('caso 237: con fechas válidas se actualizan los datos', async () => {
            const x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
            expect(x.pedidoUso.searchParams.get('from')).toBe(h.DESDE_AMPLIO);
            await expect(page.getByText(h.DESDE_AMPLIO, { exact: true }).locator('visible=true')).toBeVisible();
            expect(await tarjetas(page)).toEqual(esperadas(x.uso));
            // El rango amplio incluye objetos de meses anteriores que los últimos 30 días no tenían.
            expect(x.uso.found_objects).toBeGreaterThanOrEqual(inicial.found_objects);
            expect(x.uso.time_series.length).toBeGreaterThan(0);
        });

        await test.step('caso 239: al modificar las fechas los datos cambian acorde', async () => {
            const julio = await h.cambiarFecha(page, 'Desde', '2026-07-01');
            expect(julio.pedidoUso.searchParams.get('from')).toBe('2026-07-01');
            const julioFin = await h.cambiarFecha(page, 'Hasta', '2026-07-31');
            expect(julioFin.pedidoUso.searchParams.get('to')).toBe('2026-07-31');
            expect(await tarjetas(page)).toEqual(esperadas(julioFin.uso));
            const agosto = await h.cambiarFecha(page, 'Desde', '2026-08-01');
            const agostoFin = await h.cambiarFecha(page, 'Hasta', '2026-08-31');
            expect(agostoFin.pedidoUso.searchParams.get('from')).toBe('2026-08-01');
            expect(agostoFin.pedidoUso.searchParams.get('to')).toBe('2026-08-31');
            expect(await tarjetas(page)).toEqual(esperadas(agostoFin.uso));
            void agosto;
            // Meses distintos, movimiento distinto.
            expect(esperadas(agostoFin.uso)).not.toEqual(esperadas(julioFin.uso));
        });

        await test.step('caso 238: con "desde" mayor a "hasta" se muestra un error o no se permite', async () => {
            await h.cambiarFecha(page, 'Hasta', h.HOY());
            const hoy = h.HOY();
            const futuro = `${Number(hoy.slice(0, 4)) + 1}-01-01`;
            await h.cambiarFecha(page, 'Desde', futuro);
            const aceptada = await page.getByText(futuro, { exact: true }).locator('visible=true').count() > 0;
            const hayError = await page.getByText(/error|inv[aá]lid|mayor|anterior|no puede|incorrect/i).locator('visible=true').count() > 0;
            expect(aceptada && !hayError, 'la pantalla aceptó una fecha "desde" posterior a "hasta" sin avisar y mostró el reporte vacío').toBe(false);
        });
        await context.close();
    });

    test('casos 240, 241, 242 y 243: la agrupación por día, semana y mes se activa, actualiza y es excluyente @reportes @reportesuso @paralelo', async ({ browser }) => {
        const { context, page, pedidoUso } = await h.abrirReportes(browser);
        expect(pedidoUso.searchParams.get('groupBy')).toBe('DAY');
        await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);

        const soloActivo = async (texto) => {
            for (const t of ['Día', 'Semana', 'Mes']) {
                expect(await h.fondoDe(page, t), `${t} con ${texto} activo`).toBe(t === texto ? h.ACTIVO : 'rgb(240, 244, 244)');
            }
        };
        // Las tendencias muestran un renglón por período del servidor.
        const tendenciasCoinciden = async (uso) => {
            const sec = h.seccion(page, 'Tendencias');
            for (const p of uso.time_series) await expect(sec).toContainText(p.label);
        };

        await test.step('caso 241: Semana se activa y actualiza', async () => {
            const x = await h.apretar(page, 'Semana');
            expect(x.pedidoUso.searchParams.get('groupBy')).toBe('WEEK');
            await soloActivo('Semana');
            await tendenciasCoinciden(x.uso);
        });
        await test.step('caso 242: Mes se activa y actualiza', async () => {
            const x = await h.apretar(page, 'Mes');
            expect(x.pedidoUso.searchParams.get('groupBy')).toBe('MONTH');
            await soloActivo('Mes');
            await tendenciasCoinciden(x.uso);
        });
        await test.step('caso 240: Día se activa y actualiza', async () => {
            const x = await h.apretar(page, 'Día');
            expect(x.pedidoUso.searchParams.get('groupBy')).toBe('DAY');
            await soloActivo('Día');
            await tendenciasCoinciden(x.uso);
        });
        await test.step('caso 243: al cambiar entre opciones solo queda una seleccionada', async () => {
            for (const t of ['Mes', 'Semana', 'Día', 'Semana']) {
                await h.apretar(page, t);
                await soloActivo(t);
            }
        });
        await context.close();
    });
});
