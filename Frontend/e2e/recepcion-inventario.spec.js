// Tanda R03: inventario y detalle del objeto (carril paralelo).
const { test, expect } = require('@playwright/test');
const { foto, nombreUnico, esperarRespuesta } = require('./helpers');
const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');
const { abrirComo } = require('./helpers/t02');
const { MENSAJE_EXITO, EMPLEADO_AERO, abrirRecepcion, cargarImagen, vistaPrevia, enviarRecepcion } = require('./helpers/t03');
const { irPorMenu, tarjetas, tarjetaDe, bajarHastaVer } = require('./helpers/r03');

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
        test.setTimeout(180_000);
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('caso 083: el inventario lista los objetos con título, fecha, imagen y botones, y usa un placeholder si falta la imagen @recepcion @paralelo', async () => {
        await irPorMenu(page, 'Ver inventario');
        await expect(tarjetas(page).first()).toBeVisible();

        await caso(83, 'el inventario muestra la lista de objetos con título, fecha, imagen y botones Detalles y Devolver', async () => {
            const n = await tarjetas(page).count();
            expect(n).toBeGreaterThan(0);
            for (let i = 0; i < Math.min(n, 5); i++) {
                const t = tarjetas(page).nth(i);
                await expect(t.getByText(/^Encontrado el \d{1,2}\/\d{1,2}\/\d{4}$/)).toBeVisible();
                await expect(t.getByText('Detalles', { exact: true })).toBeVisible();
                await expect(t.getByText('Devolver', { exact: true })).toBeVisible();
                await expect(t.locator('[style*="background-image"]').first()).toBeVisible();
                expect((await t.innerText()).split('\n')[0].trim().length).toBeGreaterThan(0);
                const estilo = await t.locator('[style*="background-image"]').first().getAttribute('style');
                expect(estilo, `la tarjeta ${i + 1} no muestra una imagen del objeto`).toMatch(/http/);
            }
        });

        await caso(83, 'si un objeto no tiene imagen se muestra un placeholder (verificado con el servidor simulado sin imagen)', async () => {
            await page.route('**/found-objects/organizations/all/**', async (route) => {
                const respuesta = await route.fetch();
                const cuerpo = await respuesta.json();
                cuerpo.found_objects = cuerpo.found_objects.map((o) => ({ ...o, imageUrl: null }));
                await route.fulfill({ response: respuesta, json: cuerpo });
            });
            await irPorMenu(page, 'Ver inventario');
            await expect(tarjetas(page).first()).toBeVisible();
            const estilo = await tarjetas(page).first().locator('[style*="background-image"]').first().getAttribute('style');
            expect(estilo).toMatch(/background-image/);
            expect(estilo).not.toMatch(/localhost:9000/);
        });
    });

    test('casos 086, 087, 088 y 089: el detalle muestra la información completa y el mapa, y Volver regresa al inventario @recepcion @paralelo', async () => {
        await irPorMenu(page, 'Ver inventario');
        await expect(tarjetas(page).first()).toBeVisible();
        await bajarHastaVer(page, titulo);
        const tarjeta = tarjetaDe(page, titulo);
        await expect(tarjeta).toHaveCount(1);

        let detalleAbierto = false;
        await caso(86, 'al presionar Detalles el sistema muestra la información del objeto', async () => {
            const detalle = esperarRespuesta(page, 'POST', '/found-objects/getDetail');
            await tarjeta.getByText('Detalles', { exact: true }).click();
            expect((await detalle).status()).toBe(200);
            await expect(page.getByText('Datos del objeto')).toBeVisible();
            detalleAbierto = true;
        });

        await caso(87, 'el detalle muestra título, foto, descripción cargada por quien lo recibió, fecha de hallazgo y mapa', async () => {
            if (!detalleAbierto) return noSePudoProbar('no se abrió el detalle del objeto');
            await expect(page.getByText(titulo, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect(page.locator('[style*="background-image"][style*="http"]').locator('visible=true').first()).toBeVisible();
            await expect(page.getByText('Descripción: Billetera marrón de cuero', { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(/^Encontrado el \d{1,2}\/\d{1,2}\/\d{4} a las \d{2}:\d{2}:\d{2}$/).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText('Lugar donde fue encontrado:')).toBeVisible();
            await expect(page.locator('.leaflet-container').locator('visible=true').first()).toBeVisible();
        });

        await caso(88, 'el mapa muestra el punto donde se encontró el objeto', async () => {
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

        await caso(89, 'al presionar Volver el sistema regresa al inventario', async () => {
            if (!detalleAbierto) return noSePudoProbar('no se abrió el detalle del objeto');
            await page.getByText('Volver', { exact: true }).locator('visible=true').click();
            await expect(page.getByText('Datos del objeto')).toHaveCount(0);
            await expect(tarjetas(page).first()).toBeVisible();
        });
    });

    test('caso 112: una organización sin objetos muestra el mensaje de inventario vacío @recepcion @paralelo', async () => {
        await caso(112, 'el inventario de una organización sin objetos muestra "¡Tu organización no tiene objetos!" (verificado con el servidor simulado sin datos)', async () => {
            // El seed no tiene una organización vacía con un empleado que pueda entrar: se simula el inventario sin datos.
            await page.route('**/found-objects/organizations/all/**', (route) => route.fulfill({ json: { found_objects: [], has_more: false } }));
            await irPorMenu(page, 'Ver inventario');
            await expect(page.getByText('¡Tu organización no tiene objetos!')).toBeVisible();
        });
    });

    test('caso 085: sin conexión con el servidor el inventario avisa del error y no muestra el cartel de vacío @recepcion @paralelo', async () => {
        await caso(85, 'con el servidor caído aparece "No se pudo cargar el inventario. Verificá tu conexión." y no el inventario vacío (verificado con el servidor simulado sin conexión)', async () => {
            await page.route('**/found-objects/organizations/all/**', (route) => route.abort('connectionrefused'));
            await irPorMenu(page, 'Ver inventario');
            await expect(page.getByText('No se pudo cargar el inventario. Verificá tu conexión.').locator('visible=true').first()).toBeVisible({ timeout: 8000 });
            await expect(page.getByText('¡Tu organización no tiene objetos!')).toHaveCount(0);
        });
    });
});

test.describe('Inventario: etiquetas de vencimiento (empleado de la organización)', () => {
    test('caso 084: los objetos pasados de plazo muestran Vencido y los próximos a vencer Por vencer @recepcion @paralelo', async ({ browser }) => {
        // El servidor calcula el estado del plazo de guarda (storage_status) y lo manda a todos los roles:
        // se simula la respuesta del inventario con un objeto vencido y otro por vencer, y se entra como empleado.
        const { context, page } = await abrirComo(browser, EMPLEADO_AERO);
        try {
            await page.route('**/found-objects/organizations/all/**', async (route) => {
                const respuesta = await route.fetch();
                const cuerpo = await respuesta.json();
                const estados = ['EXPIRED', 'EXPIRING'];
                cuerpo.found_objects = cuerpo.found_objects.map((o, i) => (
                    i < estados.length ? { ...o, storage_status: estados[i] } : { ...o, storage_status: null }));
                await route.fulfill({ response: respuesta, json: cuerpo });
            });
            await caso(84, 'la primera tarjeta (EXPIRED) muestra "Vencido" y la segunda (EXPIRING) muestra "Por vencer" para un empleado (inventario simulado con storage_status)', async () => {
                await irPorMenu(page, 'Ver inventario');
                await expect(tarjetas(page).first()).toBeVisible();
                await expect(tarjetas(page).nth(0).getByText('Vencido', { exact: true })).toBeVisible();
                await expect(tarjetas(page).nth(1).getByText('Por vencer', { exact: true })).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });
});
