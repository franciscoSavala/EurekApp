const { test, expect } = require('@playwright/test');
const { USUARIOS, foto, nombreUnico, abrirComoUsuario, elegirArchivo, receptarObjeto, perderlo, abrirBusqueda } = require('./helpers');

test.describe('Búsqueda de un objeto perdido', () => {
    let titulo;

    // Un objeto recién receptado por un empleado, para que la búsqueda tenga algo propio que encontrar.
    test.beforeAll(async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.empleado);
        titulo = await receptarObjeto(page, nombreUnico('Billetera busqueda e2e'));
        await context.close();
    });

    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComoUsuario(browser, USUARIOS.usuario));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('la descripción es obligatoria: sin ella no busca @busqueda @serie', async () => {
        await abrirBusqueda(page);
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('Falta la descripción')).toBeVisible();
        await expect(page.getByText('Coincidencias encontradas')).toHaveCount(0);
    });

    test('por texto: la descripción encuentra el objeto receptado y lo muestra con su título @busqueda @serie', async () => {
        await abrirBusqueda(page);
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('Coincidencias encontradas')).toBeVisible();
        await expect(page.getByText(titulo, { exact: true })).toBeVisible();
    });

    test('por foto con descripción: la misma foto del objeto lo encuentra @busqueda @serie', async () => {
        await abrirBusqueda(page);
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await elegirArchivo(page, () => page.getByText('Seleccionar foto').click(), foto('billetera.png'));
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('Coincidencias encontradas')).toBeVisible();
        await expect(page.getByText(titulo, { exact: true })).toBeVisible();
    });

    test('por foto: rechaza una imagen en formato no permitido @busqueda @serie', async () => {
        await abrirBusqueda(page);
        await elegirArchivo(page, () => page.getByText('Seleccionar foto').click(), foto('formato_invalido.gif'));

        await expect(page.getByText('Formato no permitido')).toBeVisible();
    });

    test('sin coincidencias: en otro establecimiento no aparece el objeto y se avisa @busqueda @serie', async () => {
        await abrirBusqueda(page, 'Aeropuerto Internacional Cordoba');
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toBeVisible();
        await expect(page.getByText(titulo, { exact: true })).toHaveCount(0);
    });
});
