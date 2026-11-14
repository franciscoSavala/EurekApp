// Tanda T03: formulario de receptar un objeto (carril paralelo, empleado de Aeropuerto).
const { test, expect } = require('@playwright/test');
const { caso, foto, nombreUnico, elegirArchivo } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const {
    MENSAJE_EXITO, EMPLEADO_AERO, PUNTO_POR_DEFECTO, abrirRecepcion, abrirRecepcionLimpia, cargarImagen, vistaPrevia, interruptor,
    categoria, elegirHora, elegirDiaAtras, enviarRecepcion, objetoGuardado, receptarMinimo,
} = require('./helpers/t03');

const fondoDe = (chip) => chip.evaluate((e) => getComputedStyle(e.parentElement).backgroundColor);

test.describe('Recepción: formulario', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComo(browser, EMPLEADO_AERO));
        await abrirRecepcion(page);
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 078, 084, 086, 087 y 088: recepta con todos los campos y el objeto queda guardado con lo ingresado @recepcion @paralelo', async () => {
        const titulo = nombreUnico('Objeto completo e2e');
        const descripcion = `Descripción propia ${titulo}`;
        const email = 'valeria@mail.com';
        let fecha;

        await page.getByPlaceholder('Escribe un título').fill(titulo);
        await page.getByPlaceholder('Ingresa el email del usuario').fill(email);
        await cargarImagen(page, foto('billetera.png'));
        await expect(vistaPrevia(page)).toHaveCount(1);

        await caso(87, 'la categoría elegida queda marcada visualmente', async () => {
            const chip = categoria(page, 'Electrónica');
            const antes = await fondoDe(chip);
            await chip.click();
            await expect.poll(() => fondoDe(chip)).not.toBe(antes);
            // Las demás categorías no quedan marcadas.
            expect.soft(await fondoDe(categoria(page, 'Ropa'))).toBe(antes);
        });

        await caso(84, 'al activar el interruptor "fuera del establecimiento" aparece el mapa para ubicar el objeto', async () => {
            await interruptor(page).click({ force: true });
            await expect(page.getByText('Ubicación donde fue encontrado:')).toBeVisible();
            await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
        });

        await caso(86, 'se pueden elegir la fecha y la hora y la pantalla muestra lo elegido', async () => {
            fecha = await elegirDiaAtras(page, 2);
            await elegirHora(page, '8:15 AM');
            const dia = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
            await expect(page.getByText(dia, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect(page.getByText('08:15:00', { exact: true }).locator('visible=true').first()).toBeVisible();
        });

        await caso(88, 'la descripción escrita se acepta en el campo', async () => {
            const campo = page.getByPlaceholder('Agrega una descripción');
            await campo.fill(descripcion);
            await expect(campo).toHaveValue(descripcion);
        });

        const respuesta = await enviarRecepcion(page);
        await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
        const guardado = await objetoGuardado(page, titulo);

        await caso(78, 'el sistema registra el objeto con toda la información proporcionada', async () => {
            expect.soft(respuesta.status()).toBe(200);
            expect(guardado, 'el objeto no está en el inventario').not.toBeNull();
            expect.soft(guardado.title).toBe(titulo);
            expect.soft(guardado.finderEmail).toBe(email);
            expect.soft(guardado.imageUrl).toBeTruthy();
            expect.soft(guardado.humanDescription).toBe(descripcion);
            expect.soft(guardado.found_date).toContain('T08:15');
            // La categoría que eligió la persona tiene que ser la que se guarda.
            expect.soft(guardado.category).toBe('ELECTRONICA');
        });

        await caso(84, 'el sistema registra que el objeto fue encontrado fuera del establecimiento (guarda el punto del mapa)', async () => {
            expect(guardado).not.toBeNull();
            expect(guardado.latitude).toBeCloseTo(PUNTO_POR_DEFECTO.latitude, 3);
            expect(guardado.longitude).toBeCloseTo(PUNTO_POR_DEFECTO.longitude, 3);
        });

        await caso(86, 'el sistema guarda la fecha y la hora ingresadas', async () => {
            expect(guardado).not.toBeNull();
            const p = (n) => String(n).padStart(2, '0');
            expect(guardado.found_date).toBe(`${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T08:15:00`);
        });

        await caso(88, 'el sistema guarda la descripción ingresada', async () => {
            expect(guardado).not.toBeNull();
            expect(guardado.humanDescription).toBe(descripcion);
        });
    });

    test('casos 085 y 090: con el interruptor desactivado y sin campos opcionales el objeto queda dentro del establecimiento @recepcion @paralelo', async () => {
        const minimo = nombreUnico('Objeto minimo e2e');
        const conInterruptor = nombreUnico('Objeto interruptor e2e');
        let guardadoMinimo;

        await caso(90, 'con solo los campos obligatorios (título y foto) el sistema registra el objeto', async () => {
            const respuesta = await receptarMinimo(page, minimo);
            expect(respuesta.status()).toBe(200);
            await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
            await page.getByText('Cerrar', { exact: true }).click();
            guardadoMinimo = await objetoGuardado(page, minimo);
            expect(guardadoMinimo, 'el objeto no está en el inventario').not.toBeNull();
            expect(guardadoMinimo.title).toBe(minimo);
            expect(guardadoMinimo.finderEmail).toBeNull();
            expect(guardadoMinimo.humanDescription || '').toBe('');
        });

        await caso(85, 'al desactivar el interruptor el objeto queda registrado dentro del establecimiento', async () => {
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

    test('casos 080 y 091: con datos inválidos muestra el error y no registra el objeto @recepcion @paralelo', async () => {
        await caso(80, 'con un email inválido muestra un error de formato de email y no registra', async () => {
            await page.getByPlaceholder('Escribe un título').fill(nombreUnico('Objeto email malo e2e'));
            await page.getByPlaceholder('Ingresa el email del usuario').fill('correo.malo');
            await cargarImagen(page, foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            await page.getByText('Receptar objeto encontrado', { exact: true }).click();
            await expect.soft(page.getByText(/formato|inválid|invalid/i).locator('visible=true').first()).toBeVisible({ timeout: 8000 });
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
        });

        await caso(91, 'con datos inválidos muestra el mensaje "Campos vacíos" y no registra el objeto', async () => {
            await abrirRecepcionLimpia(page);
            await page.getByText('Receptar objeto encontrado', { exact: true }).click();
            await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
            await expect.soft(page.getByText('Campos vacíos').locator('visible=true').first()).toBeVisible({ timeout: 8000 });
        });
    });

    test('casos 081 y 083: carga una imagen desde el selector de archivos y la reemplaza por otra @recepcion @paralelo', async () => {
        let primera;

        await caso(81, 'al presionar "Seleccionar foto" y elegir una imagen, el sistema la carga', async () => {
            await expect(vistaPrevia(page)).toHaveCount(0);
            await elegirArchivo(page, () => page.getByText('Seleccionar foto').locator('visible=true').click(), foto('billetera.png'));
            await expect(vistaPrevia(page)).toHaveCount(1);
            primera = await vistaPrevia(page).getAttribute('style');
            expect(primera).toContain('blob:');
        });

        await caso(83, 'al elegir otra imagen, el sistema reemplaza la anterior por la nueva', async () => {
            await elegirArchivo(page, () => page.getByText('Seleccionar foto').locator('visible=true').click(), foto('reemplazo_zapatilla.jpg'));
            await expect.poll(() => vistaPrevia(page).getAttribute('style')).not.toBe(primera);
            await expect(vistaPrevia(page)).toHaveCount(1);
        });
    });
});
