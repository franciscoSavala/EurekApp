// Búsqueda de objetos perdidos: qué trae según texto, foto, fecha y filtros.
// Un empleado del aeropuerto recepta una billetera con título único y los usuarios buscan en ese establecimiento.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, foto, nombreUnico } = require('./helpers');
const t = require('./helpers/t02');
const { receptarComoEmpleadoConCarga } = require('./helpers/t19');

const DESCRIPCION_BILLETERA = 'billetera de cuero marron';

/** Fecha local "AAAA-MM-DD" de hace `dias` días. */
const fechaDeHace = (dias) => {
    const d = new Date(Date.now() - dias * 24 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const pedidoDeBusqueda = (page) => page.waitForRequest((r) => /\/found-objects(\/|\?)/.test(r.url()) && /[?&]query=/.test(r.url()), { timeout: 30000 });

test.describe('Búsqueda de un objeto perdido: resultados', () => {
    let titulo;
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
        titulo = await receptarComoEmpleadoConCarga(browser, USUARIOS_PARALELO.empleadoAero, nombreUnico('Billetera resultados e2e'));
    });

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('caso 062: buscar solo con la descripción, sin foto, muestra resultados sin pedir una foto @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill('billetera');
        await t.botonBuscar(page).click();

        await caso(62, 'la búsqueda solo con descripción se ejecuta y muestra resultados, sin error ni pedido de foto', async () => {
            await expect.soft(page.getByText('Coincidencias encontradas')).toBeVisible({ timeout: 30000 });
            await expect.soft(page.getByText(titulo, { exact: true })).toBeVisible();
            await expect.soft(page.getByText(/Error|No se pudo realizar la búsqueda/)).toHaveCount(0);
            await expect.soft(page.getByText(/falta.*foto|foto.*obligatoria/i)).toHaveCount(0);
        });
    });

    test('caso 049: la búsqueda usa la descripción, el establecimiento, la fecha y la hora ingresadas @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS, 2);
        // Hora estimada: 9:00 de la mañana.
        await page.getByText(/^\d{1,2}:\d{2}/).first().click();
        await page.locator('.react-datepicker__time-list-item', { hasText: /^9:00 AM$/ }).click();
        await t.descripcion(page).fill('billetera');
        const pedido = pedidoDeBusqueda(page);
        await t.botonBuscar(page).click();

        await caso(49, 'se busca en el establecimiento elegido con la descripción, la fecha y la hora ingresadas', async () => {
            const url = new URL((await pedido).url());
            expect.soft(url.pathname).toMatch(/\/found-objects\/organizations\/\d+$/);
            expect.soft(url.searchParams.get('query')).toContain('billetera');
            expect.soft(url.searchParams.get('lost_date')).toBe(`${fechaDeHace(2)}T09:00:00`);
            await expect.soft(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 30000 });
        });
    });

    test('caso 065: sumar una foto del objeto desde otro ángulo sube el porcentaje de coincidencia @busqueda @paralelo', async () => {
        let sinFoto;
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill(DESCRIPCION_BILLETERA);
        await t.botonBuscar(page).click();
        await expect(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 30000 });
        sinFoto = await t.porcentajeDe(page, titulo);
        expect(sinFoto, 'el objeto no muestra porcentaje de coincidencia en la búsqueda sin foto').not.toBeNull();

        await page.getByText('← Volver').click();
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill(DESCRIPCION_BILLETERA);
        await t.cargarFoto(page, foto('billetera_otro_angulo.jpg'));
        await t.botonBuscar(page).click();
        await expect(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 30000 });
        const conFoto = await t.porcentajeDe(page, titulo);

        await caso(65, `el porcentaje con la foto (${conFoto}%) es mayor que el de solo texto (${sinFoto}%)`, async () => {
            expect(conFoto).toBeGreaterThan(sinFoto);
        });
    });

    test('caso 066: una búsqueda de zapatillas con foto de zapatillas no trae la billetera registrada @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill('zapatillas');
        await t.cargarFoto(page, foto('reemplazo_zapatilla.jpg'));
        await t.botonBuscar(page).click();
        await t.esperarResultado(page);

        await caso(66, 'la billetera registrada no aparece en los resultados', async () => {
            await expect.soft(page.getByText(titulo, { exact: true })).toHaveCount(0);
            await expect.soft(page.getByText(/billetera/i)).toHaveCount(0);
        });
    });

    test('casos 359 y 360: filtros combinados y palabra clave @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill('billetera');
        await t.botonBuscar(page).click();

        await caso(360, 'la palabra clave trae resultados relacionados con ella', async () => {
            await expect.soft(page.getByText('Coincidencias encontradas')).toBeVisible({ timeout: 30000 });
            await expect.soft(page.getByText(titulo, { exact: true })).toBeVisible();
        });

        await page.getByText('← Volver').click();
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.abrirFiltros(page);

        await caso(359, 'con categoría, color, palabra clave y rango de fechas solo salen resultados que cumplen todo', async () => {
            await expect.soft(page.getByText('Accesorios', { exact: true }), 'los filtros avanzados no ofrecen categorías').toBeVisible({ timeout: 1000 });
            await t.descripcion(page).fill('billetera');
            await page.getByPlaceholder('Ej: rojo, azul oscuro...').fill('marron');
            // Rango: desde hace 2 días (fecha principal) hasta ayer; el objeto se receptó hoy, queda afuera.
            const ayer = fechaDeHace(1).split('-').map(Number);
            await t.elegirFechaLimite(page, ...ayer);
            await t.botonBuscar(page).click();
            await t.esperarResultado(page);
            await expect.soft(page.getByText(titulo, { exact: true }), 'trajo un objeto hallado después de la fecha límite').toHaveCount(0);
        });
    });
});
