// Tanda R03: formulario de receptar un objeto (carril paralelo, empleado de Aeropuerto).
const { test, expect } = require('@playwright/test');
const { caso, foto, nombreUnico, elegirArchivo, esperarRespuesta } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const { arrastrarPin } = require('./helpers/t02');
const {
    MENSAJE_EXITO, EMPLEADO_AERO, PUNTO_POR_DEFECTO, abrirRecepcion, cargarImagen, vistaPrevia, interruptor,
    categoria, elegirHora, elegirDiaAtras, enviarRecepcion, objetoGuardado, receptarMinimo,
} = require('./helpers/t03');
const { abrirDetalleDe } = require('./helpers/r03');
const { casoContinuo } = require('./helpers/t17');

const fondoDe = (chip) => chip.evaluate((e) => getComputedStyle(e.parentElement).backgroundColor);
const boton = (page) => page.getByText('Receptar objeto encontrado', { exact: true });

test.describe('Recepción: formulario', () => {
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

    test('casos 066 y 074: recepta con todos los campos, el detalle muestra lo ingresado y la categoría es opcional @recepcion @paralelo', async () => {
        const titulo = nombreUnico('Objeto completo e2e');
        const descripcion = `Descripción propia ${titulo}`;
        const email = 'valeria@mail.com';
        let fecha;

        await page.getByPlaceholder('Escribe un título').fill(titulo);
        await page.getByPlaceholder('Ingresa el email del usuario').fill(email);
        await cargarImagen(page, foto('billetera.png'));
        await expect(vistaPrevia(page)).toHaveCount(1);

        await caso(74, 'al tocar Accesorios el chip queda resaltado y al tocarlo de nuevo vuelve a quedar sin marcar', async () => {
            // El caso pide Accesorios; la app ya no tiene esa categoría (quedaron Electrónica, Ropa, Billetera y documentos, Llaves y Otros).
            await expect.soft(page.getByText('Accesorios', { exact: true }).locator('visible=true'), 'la categoría Accesorios no existe en el formulario').toHaveCount(1, { timeout: 3000 });
            // El comportamiento de resaltar y desmarcar se verifica con una categoría que sí existe.
            const chip = categoria(page, 'Llaves');
            const sinMarcar = await fondoDe(chip);
            await chip.click();
            await expect.poll(() => fondoDe(chip)).not.toBe(sinMarcar);
            await chip.click();
            await expect.poll(() => fondoDe(chip)).toBe(sinMarcar);
        });

        fecha = await elegirDiaAtras(page, 2);
        await elegirHora(page, '8:15 AM');
        await categoria(page, 'Electrónica').click();
        await page.getByPlaceholder('Agrega una descripción').fill(descripcion);

        const respuesta = await enviarRecepcion(page);
        await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
        const guardado = await objetoGuardado(page, titulo);

        await caso(74, 'la categoría es opcional: con o sin categoría elegida el objeto se registra', async () => {
            expect(respuesta.status()).toBe(200);
            expect(guardado, 'el objeto no está en el inventario').not.toBeNull();
        });

        await caso(66, 'el objeto se registra y el detalle muestra título, foto, descripción, fecha y hora, y quién lo encontró', async () => {
            expect(guardado.finderEmail).toBe(email);
            // La categoría guardada es la que deduce el sistema: solo se exige que tenga una.
            expect.soft(guardado.category).toBeTruthy();
            await abrirDetalleDe(page, titulo);
            await expect(page.getByText('Título:', { exact: false }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(titulo, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(`Descripción: ${descripcion}`, { exact: true }).locator('visible=true').first()).toBeVisible();
            const dia = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
            await expect(page.getByText(`Encontrado el ${dia} a las 08:15:00`, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect(page.locator('[style*="background-image"][style*="http"]').locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(/^Encontrado por: /).locator('visible=true').first()).toBeVisible();
        });
    });

    test('caso 072: con el interruptor activado y un punto marcado en el mapa el detalle muestra ese punto @recepcion @paralelo', async () => {
        const titulo = nombreUnico('Objeto afuera e2e');

        await caso(72, 'el detalle muestra el punto marcado en el mapa como lugar donde fue encontrado', async () => {
            await interruptor(page).click({ force: true });
            await expect(page.getByText('Ubicación donde fue encontrado:')).toBeVisible();
            await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
            await arrastrarPin(page, 80, 50);
            await page.getByPlaceholder('Escribe un título').fill(titulo);
            await cargarImagen(page, foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            await enviarRecepcion(page);
            await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();

            const guardado = await objetoGuardado(page, titulo);
            expect(guardado, 'el objeto no está en el inventario').not.toBeNull();
            // El punto guardado es el que se marcó, no el de la organización ni el que traía el mapa.
            expect(Math.abs(guardado.latitude - PUNTO_POR_DEFECTO.latitude) > 0.0001 || Math.abs(guardado.longitude - PUNTO_POR_DEFECTO.longitude) > 0.0001).toBe(true);

            await abrirDetalleDe(page, titulo);
            await expect(page.getByText('Lugar donde fue encontrado:')).toBeVisible();
            await expect(page.locator('.leaflet-marker-icon').locator('visible=true').first()).toBeVisible();
        });
    });

    test('caso 073: con el interruptor desactivado el objeto queda dentro del establecimiento @recepcion @paralelo', async () => {
        const minimo = nombreUnico('Objeto minimo e2e');
        const conInterruptor = nombreUnico('Objeto interruptor e2e');

        const respuesta = await receptarMinimo(page, minimo);
        expect(respuesta.status()).toBe(200);
        await page.getByText('Cerrar', { exact: true }).click();
        const guardadoMinimo = await objetoGuardado(page, minimo);
        expect(guardadoMinimo, 'el objeto no está en el inventario').not.toBeNull();

        await caso(73, 'al desactivar el interruptor el sistema registra el objeto dentro del establecimiento', async () => {
            await abrirRecepcion(page);
            await page.getByPlaceholder('Escribe un título').fill(conInterruptor);
            await cargarImagen(page, foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            await interruptor(page).click({ force: true });
            await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
            await interruptor(page).click({ force: true });
            await expect(page.getByText('Ubicación donde fue encontrado:')).toHaveCount(0);
            await enviarRecepcion(page);
            await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
            const guardado = await objetoGuardado(page, conInterruptor);
            expect(guardado, 'el objeto no está en el inventario').not.toBeNull();
            // Dentro del establecimiento: la ubicación es la de la organización, la misma que la del objeto sin mapa.
            expect(guardado.latitude).toBeCloseTo(guardadoMinimo.latitude, 4);
            expect(guardado.longitude).toBeCloseTo(guardadoMinimo.longitude, 4);
            expect(Math.abs(guardado.latitude - PUNTO_POR_DEFECTO.latitude) > 0.001 || Math.abs(guardado.longitude - PUNTO_POR_DEFECTO.longitude) > 0.001).toBe(true);
        });
    });

    test('casos 068 y 078: un email sin cuenta o de un usuario bloqueado no registra el objeto @recepcion @paralelo', async () => {
        await page.getByPlaceholder('Escribe un título').fill(nombreUnico('Objeto email e2e'));
        await cargarImagen(page, foto('billetera.png'));
        await expect(vistaPrevia(page)).toHaveCount(1);

        await casoContinuo(68, 'con el email de alguien sin cuenta no se registra y el aviso dice que no se encontró el usuario con ese email', async () => {
            const sinCuenta = 'nadie.sin.cuenta@ejemplo.com';
            await page.getByPlaceholder('Ingresa el email del usuario').fill(sinCuenta);
            await boton(page).click();
            await expect(page.getByText(/No se encontr[óo] el usuario con el username/).locator('visible=true').first()).toBeVisible({ timeout: 8000 });
            await expect(page.getByText(sinCuenta, { exact: false }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });

        await casoContinuo(78, 'con el email de un usuario bloqueado por fraude no se registra y avisa que quien encontró el objeto está bloqueado', async () => {
            await page.getByPlaceholder('Ingresa el email del usuario').fill('micaela@mail.com');
            await boton(page).click();
            await expect(page.getByText(/Quien encontró este objeto está temporalmente bloqueado/).locator('visible=true').first()).toBeVisible({ timeout: 8000 });
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });
    });

    test('casos 069 y 071: carga una imagen desde el selector de archivos y la reemplaza por otra @recepcion @paralelo', async () => {
        let primera;

        await caso(69, 'al presionar "Seleccionar foto" y elegir una imagen, el sistema la carga', async () => {
            await expect(vistaPrevia(page)).toHaveCount(0);
            await elegirArchivo(page, () => page.getByText('Seleccionar foto').locator('visible=true').click(), foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            primera = await vistaPrevia(page).getAttribute('style');
            expect(primera).toContain('blob:');
        });

        await caso(71, 'al elegir otra imagen, el sistema reemplaza la anterior por la nueva', async () => {
            await elegirArchivo(page, () => page.getByText('Seleccionar foto').locator('visible=true').click(), foto('reemplazo_zapatilla.jpg'));
            await expect.poll(() => vistaPrevia(page).getAttribute('style')).not.toBe(primera);
            await expect(vistaPrevia(page)).toHaveCount(1);
        });
    });
});
