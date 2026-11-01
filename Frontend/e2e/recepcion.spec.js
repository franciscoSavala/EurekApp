const { test, expect } = require('@playwright/test');
const { USUARIOS, foto, nombreUnico, fotoPesada, iniciarSesion, irAlMenu } = require('./helpers');

const MENSAJE_EXITO = 'El objeto fue cargado al inventario con éxito.';

test.describe('Recepción de un objeto encontrado', () => {
    test.beforeEach(async ({ page }) => {
        await iniciarSesion(page, USUARIOS.empleado);
        await irAlMenu(page, 'Receptar un objeto');
        await expect(page.getByPlaceholder('Escribe un título')).toBeVisible();
    });

    test('caso 076: la pantalla muestra todos los campos del formulario', async ({ page }) => {
        await expect(page.getByText('Titulo de la publicación:')).toBeVisible();
        await expect(page.getByText('Usuario de Eurekapp (email, opcional):')).toBeVisible();
        await expect(page.getByText('Imagen del objeto encontrado:')).toBeVisible();
        await expect(page.getByText('Seleccionar foto')).toBeVisible();
        await expect(page.getByText('Sacar Foto')).toBeVisible();
        await expect(page.getByText('El objeto fue encontrado fuera del establecimiento')).toBeVisible();
        await expect(page.getByText('Fecha y hora en la que fue encontrado:')).toBeVisible();
        await expect(page.getByText('Categoría (opcional):')).toBeVisible();
        await expect(page.getByText('Receptar objeto encontrado', { exact: true })).toBeVisible();
    });

    test('casos 077, 094, 095 y 134: recepta un objeto con título y foto PNG, muestra el aviso y queda en el inventario', async ({ page }) => {
        const titulo = nombreUnico('Billetera e2e');
        await page.getByPlaceholder('Escribe un título').fill(titulo);
        await page.locator('input[type="file"]').first().setInputFiles(foto('billetera.png'));
        await page.getByText('Receptar objeto encontrado', { exact: true }).click();

        await expect(page.getByText(MENSAJE_EXITO)).toBeVisible();
        await page.getByText('Cerrar', { exact: true }).click();
        await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);

        await irAlMenu(page, 'Ver inventario');
        await expect(page.getByText(titulo)).toBeVisible();
    });

    test('caso 079: sin título no registra el objeto y pide escribirlo', async ({ page }) => {
        await page.locator('input[type="file"]').first().setInputFiles(foto('billetera.png'));
        await page.getByText('Receptar objeto encontrado', { exact: true }).click();

        await expect(page.getByText('Por favor escribí un título para la publicación')).toBeVisible();
        await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
    });

    test('caso 092: rechaza una imagen en formato no permitido', async ({ page }) => {
        await page.locator('input[type="file"]').first().setInputFiles(foto('formato_invalido.gif'));

        await expect(page.getByText('Formato no permitido')).toBeVisible();
        await expect(page.getByText('Solo se permiten imágenes .jpg, .jpeg o .png')).toBeVisible();
    });

    test('caso 093: rechaza una imagen que supera los 10 MB', async ({ page }) => {
        await page.getByPlaceholder('Escribe un título').fill(nombreUnico('Objeto pesado e2e'));
        await page.locator('input[type="file"]').first().setInputFiles({
            name: 'pesada.jpg', mimeType: 'image/jpeg', buffer: fotoPesada(10.5),
        });
        await page.getByText('Receptar objeto encontrado', { exact: true }).click();

        await expect(page.getByText('Por favor sube una imagen de menos de 10MB')).toBeVisible();
        await expect(page.getByText(MENSAJE_EXITO)).toHaveCount(0);
    });
});
