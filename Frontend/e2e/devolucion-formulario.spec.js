const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu } = require('./helpers');
const { casoContinuo: caso } = require('./helpers/t17');
const { dniUnico, cargarFotoDeQuienRetira, completarDatos } = require('./helpers/t04');

test.describe('Devolución: teléfono y foto', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComoUsuario(browser, USUARIOS.empleado));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 094 y 095: el teléfono solo acepta números y la foto de la persona se carga @devolucion @serie', async () => {
        await irAlMenu(page, 'Ver inventario');
        await page.getByText('Devolver', { exact: true }).first().click();
        const telefono = page.getByPlaceholder('Ingresa un teléfono de contacto');
        await expect(telefono).toBeVisible();

        await caso(95, 'elegir la foto de la persona la carga y reemplaza al ícono por defecto', async () => {
            await expect(page.getByText('Seleccionar foto').last()).toBeVisible();
            await cargarFotoDeQuienRetira(page);
            // Con la foto cargada se ve una imagen local (blob o data), no la imagen por defecto.
            const vistaPrevia = page.locator('[style*="blob:"], img[src^="blob:"], img[src^="data:"]').locator('visible=true');
            await expect(vistaPrevia.first()).toBeVisible();
        });

        await caso(94, 'letras y símbolos no se escriben en Teléfono y con el campo vacío aparece "Dato obligatorio." sin registrar', async () => {
            await telefono.fill('abc-xyz+*#');
            // Lo que no es número no queda escrito en el campo.
            await expect(telefono).toHaveValue('');
            await telefono.fill('35a14b');
            await expect(telefono).toHaveValue('3514');
            await telefono.fill('');
            await completarDatos(page, { dni: dniUnico(), telefono: '' });
            await page.getByText('Registrar devolución', { exact: true }).click();
            await expect(page.getByText('Dato obligatorio.').first()).toBeVisible();
            await expect(page.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
        });
    });
});
