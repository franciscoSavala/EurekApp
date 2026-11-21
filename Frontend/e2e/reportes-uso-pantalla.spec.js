const { test, expect } = require('@playwright/test');
const { casoContinuo } = require('./helpers/t17');
const h = require('./helpers/t10');

const ETIQUETAS = ['Objetos encontrados', 'Búsquedas / perdidos', 'Objetos devueltos', 'Usuarios activos'];

test.describe('Reportes: pantalla y métricas', () => {
    test('casos 138, 139, 140 y 179: el dueño ve la pantalla de reportes, sus métricas y secciones, y el estado sin datos @reportes @reportesuso @paralelo', async ({ browser }) => {
        const r = await h.abrirReportes(browser);
        const { page } = r;

        await casoContinuo(138, 'el sistema muestra la pantalla de reportes', async () => {
            await expect(page.getByText('Reporte de uso', { exact: true }).locator('visible=true')).toBeVisible();
            await expect(page.getByText('Desde', { exact: true }).locator('visible=true')).toBeVisible();
            await expect(page.getByText('Hasta', { exact: true }).locator('visible=true')).toBeVisible();
        });

        // Rango con movimientos: las tarjetas y las secciones tienen datos.
        const x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);

        await casoContinuo(139, 'las tarjetas muestran valores numéricos de encontrados, búsquedas, devueltos y usuarios activos', async () => {
            const esperado = {
                'Objetos encontrados': x.uso.found_objects,
                'Búsquedas / perdidos': x.uso.lost_objects,
                'Objetos devueltos': x.uso.returned_objects,
                'Usuarios activos': x.uso.active_users,
            };
            for (const etiqueta of ETIQUETAS) {
                const mostrado = await h.valorDeTarjeta(page, etiqueta);
                expect.soft(mostrado, etiqueta).toMatch(/^\d+$/);
                expect.soft(Number(mostrado), etiqueta).toBe(esperado[etiqueta]);
            }
        });

        await casoContinuo(179, 'se ven Reporte de uso, Tasa de recuperación, Calificación de la atención y Tendencias', async () => {
            for (const titulo of ['Reporte de uso', 'Tasa de recuperación', 'Calificación de la atención', 'Tendencias']) {
                await expect.soft(page.getByText(titulo, { exact: true }).locator('visible=true'), titulo).toBeVisible();
            }
        });

        await casoContinuo(140, 'sin movimientos en el rango se muestra "Sin datos para el período seleccionado."', async () => {
            await h.cambiarFecha(page, 'Desde', '2020-01-01');
            const vacio = await h.cambiarFecha(page, 'Hasta', '2020-01-31');
            expect(vacio.uso.time_series).toEqual([]);
            await expect(page.getByText('Sin datos para el período seleccionado.').locator('visible=true').first()).toBeVisible({ timeout: 3000 });
        });
        await r.context.close();
    });

    test('casos 185 a 189 y 201: las tarjetas coinciden con los datos del rango y Tendencias trae sus columnas @reportes @reportesuso @paralelo', async ({ browser }) => {
        const r = await h.abrirReportes(browser);
        const { page } = r;
        const x = await h.cambiarFecha(page, 'Desde', h.DESDE_AMPLIO);
        const serie = x.uso.time_series;
        const suma = (clave) => serie.reduce((s, p) => s + p[clave], 0);
        const tarjeta = async (etiqueta) => Number(await h.valorDeTarjeta(page, etiqueta));

        // Cada tarjeta se compara con lo que registra el servidor y con la suma de los períodos.
        await casoContinuo(185, 'la tarjeta Objetos encontrados muestra la cantidad exacta del rango', async () => {
            expect(await tarjeta('Objetos encontrados')).toBe(x.uso.found_objects);
            expect(x.uso.found_objects).toBe(suma('found_objects'));
        });
        await casoContinuo(186, 'la tarjeta Búsquedas / perdidos muestra la cantidad exacta del rango', async () => {
            expect(await tarjeta('Búsquedas / perdidos')).toBe(x.uso.lost_objects);
            expect(x.uso.lost_objects).toBe(suma('lost_objects'));
        });
        await casoContinuo(187, 'la tarjeta Objetos devueltos muestra la cantidad exacta del rango', async () => {
            expect(await tarjeta('Objetos devueltos')).toBe(x.uso.returned_objects);
            expect(x.uso.returned_objects).toBe(suma('returned_objects'));
        });
        await casoContinuo(188, 'la tarjeta Usuarios activos muestra la cantidad exacta del rango', async () => {
            expect(await tarjeta('Usuarios activos')).toBe(x.uso.active_users);
            expect(x.uso.active_users).toBeGreaterThan(0);
        });
        await casoContinuo(189, 'las cuatro tarjetas coinciden con los datos', async () => {
            expect(await tarjeta('Objetos encontrados')).toBe(suma('found_objects'));
            expect(await tarjeta('Búsquedas / perdidos')).toBe(suma('lost_objects'));
            expect(await tarjeta('Objetos devueltos')).toBe(suma('returned_objects'));
            expect(await tarjeta('Usuarios activos')).toBe(x.uso.active_users);
        });

        await casoContinuo(201, 'Tendencias tiene las columnas Período, Encontrados, Perdidos, Devueltos y T. Recup. con valores del período', async () => {
            const sec = h.seccion(page, 'Tendencias');
            for (const columna of ['Período', 'Encontrados', 'Perdidos', 'Devueltos', 'T. Recup.']) {
                await expect(sec.getByText(columna, { exact: true }), columna).toBeVisible();
            }
            for (const p of serie) await expect(sec).toContainText(p.label);
            const lineas = (await sec.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
            const i = lineas.indexOf(serie[0].label);
            expect(lineas.slice(i + 1, i + 4).map(Number)).toEqual([serie[0].found_objects, serie[0].lost_objects, serie[0].returned_objects]);
        });
        await r.context.close();
    });
});
