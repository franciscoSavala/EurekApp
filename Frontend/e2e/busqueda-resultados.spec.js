// Búsqueda de objetos perdidos: qué trae según texto, foto, fecha y filtros.
// Un empleado del aeropuerto recepta una billetera con título único y los usuarios buscan en ese establecimiento.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, foto, nombreUnico } = require('./helpers');
const t = require('./helpers/t02');
const { receptarComoEmpleadoConCarga } = require('./helpers/t19');
const r = require('./helpers/r02');

const DESCRIPCION_BILLETERA = 'billetera de cuero marron';

/** Fecha local "AAAA-MM-DD" de hace `dias` días (negativo: dentro de `dias` días). */
const fechaDeHace = (dias) => {
    const d = new Date(Date.now() - dias * 24 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const pedidoDeBusqueda = (page) => page.waitForRequest((r) => /\/found-objects(\/|\?)/.test(r.url()) && /[?&]query=/.test(r.url()), { timeout: 30000 });

test.describe('Búsqueda de un objeto perdido: resultados', () => {
    let titulo;
    // El título del objeto tal como se ve en la lista de resultados (no en el campo de descripción).
    const tarjetaDe = (p) => p.locator('div[dir="auto"]', { hasText: titulo }).locator('visible=true');
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

    test('caso 044: buscar solo con la descripción, sin foto, muestra resultados sin pedir una foto @busqueda @paralelo', async () => {
        await caso(44, 'con la descripción completa y con una sola palabra clave, sin foto, se muestran resultados relacionados sin error ni pedido de foto', async () => {
            for (const texto of [DESCRIPCION_BILLETERA, 'billetera']) {
                await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
                await t.descripcion(page).fill(texto);
                await t.botonBuscar(page).click();
                await expect.soft(page.getByText('Coincidencias encontradas')).toBeVisible({ timeout: 30000 });
                await expect.soft(page.getByText(titulo, { exact: true }), `la búsqueda "${texto}" no trajo la billetera registrada`).toBeVisible();
                await expect.soft(page.getByText(/Error|No se pudo realizar la búsqueda/)).toHaveCount(0);
                await expect.soft(page.getByText(/falta.*foto|foto.*obligatoria/i)).toHaveCount(0);
                await page.getByText('← Volver').click();
            }
        });
    });

    test('caso 035: la búsqueda usa la descripción, el establecimiento, la fecha y la hora ingresadas @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS, 2);
        // Hora estimada: 9:00 de la mañana.
        await page.getByText(/^\d{1,2}:\d{2}/).first().click();
        await page.locator('.react-datepicker__time-list-item', { hasText: /^9:00 AM$/ }).click();
        await t.descripcion(page).fill('billetera');
        const pedido = pedidoDeBusqueda(page);
        await t.botonBuscar(page).click();

        await caso(35, 'se busca en el establecimiento elegido con la descripción, la fecha y la hora ingresadas', async () => {
            const url = new URL((await pedido).url());
            expect.soft(url.pathname).toMatch(/\/found-objects\/organizations\/\d+$/);
            expect.soft(url.searchParams.get('query')).toContain('billetera');
            expect.soft(url.searchParams.get('lost_date')).toBe(`${fechaDeHace(2)}T09:00:00`);
            await expect.soft(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 30000 });
        });
    });

    test('caso 037: búsqueda con color y fecha límite en los filtros avanzados @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill(titulo);
        await t.abrirFiltros(page);
        await page.getByPlaceholder('Ej: rojo, azul oscuro...').fill('marron');
        // Fecha límite dentro de unos días: el objeto receptado hoy queda dentro del rango.
        const [anio, mes, dia] = fechaDeHace(-5).split('-').map(Number);
        await t.elegirFechaLimite(page, anio, mes, dia);
        const pedido = pedidoDeBusqueda(page);
        await t.botonBuscar(page).click();

        await caso(37, 'la búsqueda se hace con la descripción y el color, limitada a la fecha elegida, y los resultados muestran los indicadores y Limpiar filtros', async () => {
            const url = new URL((await pedido).url());
            expect.soft(url.searchParams.get('query')).toContain(titulo);
            expect.soft(url.searchParams.get('query')).toContain('marron');
            const limite = url.searchParams.get('lost_date_to') ?? url.searchParams.get('lostDateTo');
            expect.soft(limite, 'la búsqueda no envió la fecha límite elegida').toMatch(new RegExp(`^${fechaDeHace(-5)}`));
            await t.esperarResultado(page);
            await expect.soft(page.getByText('Coincidencias encontradas')).toBeVisible();
            await expect.soft(page.getByText('marron', { exact: true }).locator('visible=true')).toBeVisible();
            await expect.soft(page.getByText(`hasta ${fechaDeHace(-5)}`, { exact: true }).locator('visible=true')).toBeVisible();
            await expect.soft(page.getByText('Limpiar filtros', { exact: true }).locator('visible=true')).toBeVisible();
            await expect.soft(tarjetaDe(page)).toBeVisible();
        });

        await caso(37, 'una fecha límite anterior a la recepción deja afuera el objeto y, si nada coincide, avisa', async () => {
            await page.getByText('← Volver').click();
            await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
            await t.descripcion(page).fill(titulo);
            await t.abrirFiltros(page);
            await page.getByPlaceholder('Ej: rojo, azul oscuro...').fill('marron');
            const ayer = fechaDeHace(1).split('-').map(Number);
            await t.elegirFechaLimite(page, ...ayer);
            await t.botonBuscar(page).click();
            await t.esperarResultado(page);
            await expect.soft(tarjetaDe(page), 'trajo un objeto hallado después de la fecha límite').toHaveCount(0);
        });
    });

    test('caso 038: los filtros avanzados no tienen categoría y los resultados muestran la categoría detectada @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.abrirFiltros(page);

        await caso(38, 'los filtros solo ofrecen Color y Fecha límite y, al buscar "billetera negra", los resultados muestran "Categoría detectada"', async () => {
            await expect.soft(page.getByText('Color (opcional):')).toBeVisible();
            await expect.soft(page.getByText('Fecha límite de búsqueda (hasta):')).toBeVisible();
            await expect.soft(page.getByText(/categor[ií]a/i).locator('visible=true'), 'los filtros avanzados muestran un selector de categoría').toHaveCount(0);
            await page.getByText('Filtros avanzados', { exact: true }).click();
            await t.descripcion(page).fill('billetera negra');
            await t.botonBuscar(page).click();
            await expect.soft(page.getByText('Coincidencias encontradas')).toBeVisible({ timeout: 30000 });
            await expect.soft(page.getByText(/Categoría detectada: .+/)).toBeVisible();
        });
    });

    test('caso 051: la búsqueda no depende de mayúsculas ni de tildes @busqueda @paralelo', async () => {
        // El objeto lleva un sufijo único para reconocerlo entre los de otras corridas.
        const sufijo = nombreUnico('').trim();
        const tituloCampera = `Campera azul ${sufijo}`;
        await r.conApi((request) => r.receptarPorApi(request, USUARIOS_PARALELO.empleadoAero, tituloCampera));

        await caso(51, 'el objeto registrado como "Campera azul" aparece al buscar "CAMPERA azúl" y "campera azul"', async () => {
            for (const texto of [`CAMPERA azúl ${sufijo}`, `campera azul ${sufijo}`]) {
                await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
                await t.descripcion(page).fill(texto);
                await t.botonBuscar(page).click();
                await expect.soft(page.getByText('Coincidencias encontradas'), `la búsqueda "${texto}" no trajo resultados`).toBeVisible({ timeout: 30000 });
                await expect.soft(page.locator('div[dir="auto"]', { hasText: tituloCampera }).locator('visible=true'), `la búsqueda "${texto}" no trajo la campera registrada`).toBeVisible();
                await page.getByText('← Volver').click();
            }
        });
    });

    test('caso 047: sumar una foto del objeto desde otro ángulo sube el porcentaje de coincidencia @busqueda @paralelo', async () => {
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

        await caso(47, `el porcentaje con la foto (${conFoto}%) es mayor que el de solo texto (${sinFoto}%)`, async () => {
            expect(conFoto).toBeGreaterThan(sinFoto);
        });
    });

    test('caso 048: una búsqueda de zapatillas con foto de zapatillas no trae la billetera registrada @busqueda @paralelo', async () => {
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill('zapatillas');
        await t.cargarFoto(page, foto('reemplazo_zapatilla.jpg'));
        await t.botonBuscar(page).click();
        await t.esperarResultado(page);

        await caso(48, 'la billetera registrada no aparece en los resultados', async () => {
            await expect.soft(page.getByText(titulo, { exact: true })).toHaveCount(0);
            await expect.soft(page.getByText(/billetera/i)).toHaveCount(0);
        });
    });
});
