// Tanda T03: inventario y detalle del objeto (carril paralelo).
const { test, expect } = require('@playwright/test');
const { foto, nombreUnico, irAlMenu, esperarRespuesta } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');
const { abrirComo } = require('./helpers/t02');
const { MENSAJE_EXITO, EMPLEADO_AERO, URL_BACKEND, abrirRecepcion, cargarImagen, vistaPrevia, enviarRecepcion } = require('./helpers/t03');

const DUENO_PATIO = 'owner.patio@eurekapp.com';

const CON_IMAGEN = "xpath=ancestor::div[.//*[contains(@style,'background-image')]][1]";

/** Las tarjetas visibles del inventario (una por objeto), a partir de su botón Devolver. */
const tarjetas = (page) => page.getByText('Devolver', { exact: true }).locator('visible=true').locator(CON_IMAGEN);

/** La tarjeta del objeto con ese título. */
const tarjetaDe = (page, titulo) => page.getByText(titulo, { exact: true }).locator('visible=true').locator(CON_IMAGEN);

test.describe('Inventario y detalle del objeto', () => {
    let context;
    let page;
    let titulo;

    test.beforeAll(async ({ browser }) => {
        // Un objeto propio con descripción, para tener algo que mirar aunque el seed cambie.
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
        titulo = nombreUnico('Billetera inventario e2e');
        await abrirRecepcion(page);
        await page.getByPlaceholder('Escribe un título').fill(titulo);
        await cargarImagen(page, foto('billetera.png'));
        await expect(vistaPrevia(page)).toHaveCount(1);
        await page.getByPlaceholder('Agrega una descripción').fill('Billetera marrón de cuero');
        const respuesta = await enviarRecepcion(page);
        expect(respuesta.status()).toBe(200);
        await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
        await context.close();
    });

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 108 y 109: el inventario lista los objetos con título, fecha, imagen y botones, y usa un placeholder si falta la imagen @recepcion @paralelo', async () => {
        await irAlMenu(page, 'Ver inventario');
        await expect(tarjetas(page).first()).toBeVisible();

        await caso(108, 'el inventario muestra la lista de objetos con título, fecha, imagen y botones Detalles y Devolver', async () => {
            const n = await tarjetas(page).count();
            expect(n).toBeGreaterThan(0);
            for (let i = 0; i < Math.min(n, 5); i++) {
                const t = tarjetas(page).nth(i);
                await expect(t.getByText(/^Encontrado el \d{1,2}\/\d{1,2}\/\d{4}$/)).toBeVisible();
                await expect(t.getByText('Detalles', { exact: true })).toBeVisible();
                await expect(t.getByText('Devolver', { exact: true })).toBeVisible();
                await expect(t.locator('[style*="background-image"]').first()).toBeVisible();
                expect((await t.innerText()).split('\n')[0].trim().length).toBeGreaterThan(0);
            }
        });

        await caso(109, 'cada objeto listado muestra su imagen', async () => {
            const n = Math.min(await tarjetas(page).count(), 5);
            for (let i = 0; i < n; i++) {
                const estilo = await tarjetas(page).nth(i).locator('[style*="background-image"]').first().getAttribute('style');
                expect(estilo, `la tarjeta ${i + 1} no muestra una imagen del objeto`).toMatch(/http/);
            }
        });

        await caso(109, 'si un objeto no tiene imagen se muestra un placeholder (verificado con el servidor simulado sin imagen)', async () => {
            await page.route('**/found-objects/organizations/all/**', async (route) => {
                const respuesta = await route.fetch();
                const cuerpo = await respuesta.json();
                cuerpo.found_objects = cuerpo.found_objects.map((o) => ({ ...o, imageUrl: null }));
                await route.fulfill({ response: respuesta, json: cuerpo });
            });
            await page.goto('/');
            await expect(page.getByText('Logout')).toBeVisible();
            await irAlMenu(page, 'Ver inventario');
            await expect(tarjetas(page).first()).toBeVisible();
            const estilo = await tarjetas(page).first().locator('[style*="background-image"]').first().getAttribute('style');
            expect(estilo).toMatch(/background-image/);
            expect(estilo).not.toMatch(/localhost:9000/);
        });
    });

    test('casos 110, 111, 112 y 113: el detalle muestra la información completa y el mapa, y Volver regresa al inventario @recepcion @paralelo', async () => {
        await irAlMenu(page, 'Ver inventario');
        await expect(tarjetas(page).first()).toBeVisible();
        const tarjeta = await (async () => {
            const propia = tarjetaDe(page, titulo);
            if (await propia.count() > 0) return propia;
            return tarjetas(page).first();
        })();

        let detalleAbierto = false;
        await caso(110, 'al presionar Detalles el sistema muestra la información del objeto', async () => {
            const detalle = esperarRespuesta(page, 'POST', '/found-objects/getDetail');
            await tarjeta.getByText('Detalles', { exact: true }).click();
            expect((await detalle).status()).toBe(200);
            await expect(page.getByText('Datos del objeto')).toBeVisible();
            detalleAbierto = true;
        });

        await caso(111, 'el detalle muestra título, descripción, descripción de la IA, fecha y ubicación', async () => {
            if (!detalleAbierto) return noSePudoProbar('no se abrió el detalle del objeto');
            await expect(page.getByText('Título:', { exact: false }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(/^Descripción: .+/).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText('Encontrado el', { exact: false }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText('Lugar donde fue encontrado:')).toBeVisible();
            // La descripción de la IA tiene que traer texto, no quedar vacía.
            await expect.soft(page.getByText(/^Descripción provista por la IA: .+/).locator('visible=true').first()).toBeVisible({ timeout: 5000 });
        });

        await caso(112, 'el mapa muestra el punto donde se encontró el objeto', async () => {
            if (!detalleAbierto) return noSePudoProbar('no se abrió el detalle del objeto');
            const marcador = page.locator('.leaflet-marker-icon').locator('visible=true').first();
            await expect(marcador).toBeVisible();
            const mapa = page.locator('.leaflet-container').locator('visible=true').first();
            await expect(mapa.locator('.leaflet-tile').first()).toBeVisible();
            const cm = await mapa.boundingBox();
            await expect.poll(async () => {
                const m = await marcador.boundingBox();
                return Math.abs((m.x + m.width / 2) - (cm.x + cm.width / 2)) < 60;
            }).toBe(true);
        });

        await caso(113, 'al presionar Volver el sistema regresa al inventario', async () => {
            if (!detalleAbierto) return noSePudoProbar('no se abrió el detalle del objeto');
            await page.getByText('Volver', { exact: true }).locator('visible=true').click();
            await expect(page.getByText('Datos del objeto')).toHaveCount(0);
            await expect(tarjetas(page).first()).toBeVisible();
        });
    });

    test('caso 133: una organización sin objetos muestra el mensaje de inventario vacío @recepcion @paralelo', async ({ browser }) => {
        // El empleado de Patio Olmos está bloqueado en el seed: se usa su dueño, que también ve el inventario.
        const { context: ctx, page: pagina } = await abrirComo(browser, DUENO_PATIO);
        try {
            await caso(133, 'el inventario de una organización sin objetos muestra "¡Tu organización no tiene objetos!"', async () => {
                const org = await pagina.evaluate(() => localStorage.getItem('org.id'));
                const jwt = await pagina.evaluate(() => localStorage.getItem('jwt'));
                const r = await pagina.request.get(`${URL_BACKEND}/found-objects/organizations/all/${org}?page=0&pageSize=5`, { headers: { Authorization: `Bearer ${jwt}` } });
                const hayObjetos = (await r.json()).found_objects.length > 0;
                if (hayObjetos) {
                    // Si el seed cargó objetos, se simula el servidor sin datos.
                    await pagina.route('**/found-objects/organizations/all/**', (route) => route.fulfill({ json: { found_objects: [], has_more: false } }));
                }
                // Se recarga para que el inventario se pida de nuevo con el servidor ya preparado.
                await pagina.goto('/');
                await expect(pagina.getByText('Logout')).toBeVisible();
                await irAlMenu(pagina, 'Ver inventario');
                await expect(pagina.getByText('¡Tu organización no tiene objetos!')).toBeVisible();
            });
        } finally {
            await ctx.close();
        }
    });
});
