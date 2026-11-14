const { test, expect } = require('@playwright/test');
const { USUARIOS, abrirComoUsuario, irAlMenu, caso } = require('./helpers');
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

    test('casos 119 y 120: el teléfono solo acepta números y la foto de la persona se carga @devolucion @serie', async () => {
        await irAlMenu(page, 'Ver inventario');
        await page.getByText('Devolver', { exact: true }).first().click();
        const telefono = page.getByPlaceholder('Ingresa un teléfono de contacto');
        await expect(telefono).toBeVisible();

        await caso(120, 'la foto elegida se carga y reemplaza al ícono por defecto', async () => {
            await expect(page.getByText('Seleccionar foto').last()).toBeVisible();
            await cargarFotoDeQuienRetira(page);
            // Con la foto cargada se ve una imagen local (blob o data), no la imagen por defecto.
            const vistaPrevia = page.locator('[style*="blob:"], img[src^="blob:"], img[src^="data:"]').locator('visible=true');
            await expect(vistaPrevia.first()).toBeVisible();
        });

        await caso(119, 'un teléfono con letras o símbolos no se acepta y el formulario no se envía', async () => {
            await telefono.fill('abc-xyz');
            // Lo que no es número no queda escrito en el campo.
            await expect(telefono).toHaveValue('');
            await completarDatos(page, { dni: dniUnico(), telefono: 'abc-xyz' });
            await page.getByText('Registrar devolución', { exact: true }).click();
            await expect(page.getByText('Dato obligatorio.').first()).toBeVisible();
            await expect(page.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
            await telefono.fill('35a14b');
            await expect(telefono).toHaveValue('3514');
        });
    });
});
