// Tanda R03: pantalla Receptar un objeto, éxito y validaciones (carril paralelo, empleado de Aeropuerto).
const { test, expect } = require('@playwright/test');
const { caso, foto, nombreUnico, fotoPesada } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    MENSAJE_EXITO, EMPLEADO_AERO, PUNTO_POR_DEFECTO, abrirRecepcion, cargarImagen, vistaPrevia, enviarRecepcion, objetoGuardado,
} = require('./helpers/t03');
const { irPorMenu, tarjetas, modalAbierto, bajarHastaVer } = require('./helpers/r03');

const boton = (page) => page.getByText('Receptar objeto encontrado', { exact: true });

test.describe('Recepción de un objeto encontrado', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        test.setTimeout(180_000);
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
        await abrirRecepcion(page);
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('caso 064: la pantalla muestra todos los campos del formulario @recepcion @paralelo', async () => {
        await caso(64, 'la pantalla Receptar un objeto muestra todos sus campos y el botón', async () => {
            await expect(page.getByText('Titulo de la publicación:')).toBeVisible();
            await expect(page.getByPlaceholder('Escribe un título')).toBeVisible();
            await expect(page.getByText('Usuario de Eurekapp (email, opcional):')).toBeVisible();
            await expect(page.getByText('Imagen del objeto encontrado:')).toBeVisible();
            await expect(page.getByText('Seleccionar foto')).toBeVisible();
            await expect(page.getByText('Sacar Foto')).toBeVisible();
            await expect(page.getByText('El objeto fue encontrado fuera del establecimiento')).toBeVisible();
            await expect(page.getByText('Fecha y hora en la que fue encontrado:')).toBeVisible();
            await expect(page.getByText('Categoría (opcional):')).toBeVisible();
            await expect(page.getByPlaceholder('Agrega una descripción')).toBeVisible();
            await expect(boton(page)).toBeVisible();
        });
    });

    test('casos 065 y 080: recepta con título y foto, muestra el modal de éxito y el objeto queda en el inventario @recepcion @paralelo', async () => {
        const titulo = nombreUnico('Billetera e2e');
        await page.getByPlaceholder('Escribe un título').fill(titulo);
        await cargarImagen(page, foto('billetera.png'));
        await expect(vistaPrevia(page)).toHaveCount(1);
        const respuesta = await enviarRecepcion(page);
        expect(respuesta.status()).toBe(200);

        await caso(80, 'se abre un modal con ícono informativo, el texto de éxito y el botón Cerrar', async () => {
            await expect(modalAbierto(page).getByText(MENSAJE_EXITO)).toBeVisible();
            await expect(modalAbierto(page).locator('div[style*="FontAwesome6"]').first()).toBeVisible();
            await expect(modalAbierto(page).getByText('Cerrar', { exact: true })).toBeVisible();
        });

        await page.getByText('Cerrar', { exact: true }).click();
        await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);

        await caso(65, 'con datos mínimos el objeto figura en Ver inventario, dentro del establecimiento y sin descripción', async () => {
            await irPorMenu(page, 'Ver inventario');
            await bajarHastaVer(page, titulo);
            const guardado = await objetoGuardado(page, titulo);
            expect(guardado, 'el objeto no está en el inventario').not.toBeNull();
            expect.soft(guardado.humanDescription || '').toBe('');
            expect.soft(guardado.finderEmail).toBeNull();
            // Dentro del establecimiento: la ubicación es la de la organización, no el punto por defecto del mapa.
            expect.soft(Math.abs(guardado.latitude - PUNTO_POR_DEFECTO.latitude) > 0.001 || Math.abs(guardado.longitude - PUNTO_POR_DEFECTO.longitude) > 0.001).toBe(true);
        });
    });

    test('caso 067: sin título no registra el objeto y pide escribirlo @recepcion @paralelo', async () => {
        await caso(67, 'con foto y el título vacío o con solo espacios no se registra y avisa que falta el título', async () => {
            await cargarImagen(page, foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            await boton(page).click();
            await expect(page.getByText('Por favor escribí un título para la publicación').locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);

            await page.getByPlaceholder('Escribe un título').fill('   ');
            await boton(page).click();
            await expect(page.getByText('Por favor escribí un título para la publicación').locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });
    });

    test('caso 075: sin imagen no registra el objeto y pide subir una @recepcion @paralelo', async () => {
        await caso(75, 'con los campos completos y sin imagen no registra y muestra "Por favor sube una imagen"', async () => {
            await page.getByPlaceholder('Escribe un título').fill(nombreUnico('Objeto sin foto e2e'));
            await boton(page).click();
            await expect(page.getByText('Por favor sube una imagen', { exact: true })).toBeVisible();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });
    });

    test('casos 076 y 077: rechaza una imagen en formato no permitido y una que supera los 10 MB @recepcion @paralelo', async () => {
        await caso(76, 'al cargar un archivo que no es una imagen permitida el sistema lo rechaza', async () => {
            await cargarImagen(page, foto('formato_invalido.gif'));
            await expect(page.getByText('Formato no permitido')).toBeVisible();
            await expect(page.getByText('Solo se permiten imágenes .jpg, .jpeg o .png')).toBeVisible();
        });

        await caso(77, 'al cargar una imagen muy pesada el sistema avisa que pesa demasiado y no registra', async () => {
            await page.getByPlaceholder('Escribe un título').fill(nombreUnico('Objeto pesado e2e'));
            await cargarImagen(page, { name: 'pesada.jpg', mimeType: 'image/jpeg', buffer: fotoPesada(10.5) });
            await boton(page).click();
            await expect(page.getByText('Por favor sube una imagen de menos de 10MB')).toBeVisible();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });
    });

    test('caso 079: un título de 101 caracteres no se registra y avisa el límite @recepcion @paralelo', async () => {
        await caso(79, 'con un título de 101 caracteres aparece "El título no puede superar los 100 caracteres"', async () => {
            await cargarImagen(page, foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            await page.getByPlaceholder('Escribe un título').fill(nombreUnico('Largo ').padEnd(101, 'x'));
            await boton(page).click();
            await expect(page.getByText('El título no puede superar los 100 caracteres').locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });
    });

    test('caso 113: al receptar desde un inventario vacío, el mensaje desaparece y se ve el objeto agregado @recepcion @paralelo', async () => {
        const titulo = nombreUnico('Objeto primero e2e');
        // El seed no tiene una organización vacía que reciba objetos: se simula el inventario sin datos.
        await page.route('**/found-objects/organizations/all/**', (route) => route.fulfill({ json: { found_objects: [], has_more: false } }));
        await irPorMenu(page, 'Ver inventario');
        await expect(page.getByText('¡Tu organización no tiene objetos!')).toBeVisible();

        await caso(113, 'tras receptar un objeto y volver al inventario el mensaje desaparece y se muestra el objeto (servidor simulado sin datos al principio)', async () => {
            await irPorMenu(page, 'Receptar un objeto');
            await page.getByPlaceholder('Escribe un título').fill(titulo);
            await cargarImagen(page, foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            const respuesta = await enviarRecepcion(page);
            expect(respuesta.status()).toBe(200);
            await page.getByText('Cerrar', { exact: true }).click();
            // El servidor deja de estar simulado: el inventario vuelve a pedirse con el objeto ya cargado.
            await page.unroute('**/found-objects/organizations/all/**');
            await irPorMenu(page, 'Ver inventario');
            await bajarHastaVer(page, titulo);
            await expect(page.getByText('¡Tu organización no tiene objetos!')).toHaveCount(0);
            await expect(tarjetas(page).first()).toBeVisible();
        });
    });
});
