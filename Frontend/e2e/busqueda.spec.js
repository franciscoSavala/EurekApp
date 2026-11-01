const { test, expect } = require('@playwright/test');
const { USUARIOS, foto, nombreUnico, abrirComoUsuario, elegirArchivo, irAlMenu, receptarObjeto } = require('./helpers');

/**
 * Cambia la fecha en la que "se perdió" el objeto a unos días atrás. Por defecto la búsqueda usa
 * hace 3 horas, y un objeto recién receptado puede quedar unos minutos antes de esa hora.
 */
async function perderlo(page, diasAtras) {
    const destino = new Date(Date.now() - diasAtras * 24 * 3600 * 1000);
    await page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/).first().click();
    const hoy = new Date();
    if (destino.getMonth() !== hoy.getMonth()) await page.getByRole('button', { name: 'Previous Month' }).click();
    const dia = String(destino.getDate()).padStart(3, '0');
    await page.locator(`.react-datepicker__day--${dia}:not(.react-datepicker__day--outside-month)`).click();
}

/** Abre la pantalla de búsqueda, elige la organización donde se perdió el objeto y la fecha de pérdida. */
async function abrirBusqueda(page, organizacion = 'UTN FRC') {
    await irAlMenu(page, 'Buscar un objeto');
    await expect(page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo')).toBeVisible();
    await page.locator('select').first().selectOption({ label: organizacion });
    await perderlo(page, 2);
}

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

    test('la descripción es obligatoria: sin ella no busca', async () => {
        await abrirBusqueda(page);
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('Falta la descripción')).toBeVisible();
        await expect(page.getByText('Coincidencias encontradas')).toHaveCount(0);
    });

    test('por texto: la descripción encuentra el objeto receptado y lo muestra con su título', async () => {
        await abrirBusqueda(page);
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('Coincidencias encontradas')).toBeVisible();
        await expect(page.getByText(titulo, { exact: true })).toBeVisible();
    });

    test('por foto con descripción: la misma foto del objeto lo encuentra', async () => {
        await abrirBusqueda(page);
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await elegirArchivo(page, () => page.getByText('Seleccionar foto').click(), foto('billetera.png'));
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('Coincidencias encontradas')).toBeVisible();
        await expect(page.getByText(titulo, { exact: true })).toBeVisible();
    });

    test('por foto: rechaza una imagen en formato no permitido', async () => {
        await abrirBusqueda(page);
        await elegirArchivo(page, () => page.getByText('Seleccionar foto').click(), foto('formato_invalido.gif'));

        await expect(page.getByText('Formato no permitido')).toBeVisible();
    });

    test('sin coincidencias: en otro establecimiento no aparece el objeto y se avisa', async () => {
        await abrirBusqueda(page, 'Aeropuerto Internacional Cordoba');
        await page.getByPlaceholder('Proporciona detalles que ayuden a identificarlo').fill('billetera');
        await page.getByText('Buscar objeto', { exact: true }).click();

        await expect(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toBeVisible();
        await expect(page.getByText(titulo, { exact: true })).toHaveCount(0);
    });
});
