const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico, abrirComoUsuario, irAlMenu, bajarHastaVer } = require('./helpers');
const { imagenDe, receptarConDescripcion, dniUnico, abrirFormularioDevolucion, cargarFotoDeQuienRetira, completarDatos, tarjetaDevuelto } = require('./helpers/t04');
const { casoContinuo: caso, noSePudoProbar } = require('./helpers/t17');

test.describe('Objetos devueltos', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComoUsuario(browser, USUARIOS.empleado));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 123 a 131: devolución duplicada rechazada y consulta de los objetos devueltos @devolucion @serie', async () => {
        test.setTimeout(240000);
        const descripcion = 'Llavero con chapita plateada';
        const titulo = await receptarConDescripcion(page, nombreUnico('Llavero devuelto e2e'), descripcion);
        const dni = dniUnico();
        const telefono = '3514123456';

        // Segunda pestaña con el formulario abierto antes de que el objeto se devuelva.
        const segunda = await context.newPage();
        await segunda.goto('/');
        await expect(segunda.getByText('Logout')).toBeVisible();
        await abrirFormularioDevolucion(segunda, titulo);
        await cargarFotoDeQuienRetira(segunda);
        await completarDatos(segunda, { dni: dniUnico(), telefono: '3519999999' });

        await abrirFormularioDevolucion(page, titulo);
        await cargarFotoDeQuienRetira(page);
        await completarDatos(page, { dni, telefono });
        await page.getByText('Registrar devolución', { exact: true }).click();
        await expect(page.getByText('La devolución del objeto se registró correctamente.')).toBeVisible();

        await caso(123, 'devolver otra vez un objeto ya devuelto muestra el error de objeto ya devuelto', async () => {
            await segunda.getByText('Registrar devolución', { exact: true }).click();
            await expect(segunda.getByText('Este objeto ya fue devuelto anteriormente.').first()).toBeVisible();
            await expect(segunda.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
        });
        await segunda.close();

        // Si el objeto recién devuelto no aparece en el listado, los casos que parten de su tarjeta no se pueden probar.
        let aparece = false;
        await caso(124, 'Ver objetos devueltos muestra la lista de objetos devueltos', async () => {
            await irAlMenu(page, 'Ver objetos devueltos');
            await expect(page.getByText('Ver devolución', { exact: true }).locator('visible=true').first()).toBeVisible();
            await bajarHastaVer(page, titulo);
            aparece = true;
        });

        const tarjeta = tarjetaDevuelto(page, titulo);

        await caso(125, 'cada objeto muestra título, descripción, fecha, imagen y los botones Detalles y Ver devolución', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await expect.soft(tarjeta.getByText(titulo, { exact: true })).toBeVisible();
            await expect.soft(tarjeta.getByText('Descripción: ' + descripcion)).toBeVisible();
            await expect.soft(tarjeta.getByText(/Encontrado el \d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
            await expect.soft(tarjeta.getByText('Detalles', { exact: true })).toBeVisible();
            await expect.soft(tarjeta.getByText('Ver devolución', { exact: true })).toBeVisible();
            await expect.soft(imagenDe(tarjeta)).toBeVisible();
        });

        await caso(126, 'Detalles muestra título, foto y descripción del objeto', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await tarjeta.getByText('Detalles', { exact: true }).click();
            await expect(page.getByText('Datos del objeto')).toBeVisible();
            await expect.soft(page.getByText(titulo, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.getByText(descripcion).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.locator('[style*="background-image"]').locator('visible=true').first()).toBeVisible();
        });

        await caso(127, 'Volver desde los detalles regresa a Ver objetos devueltos', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await page.getByText('Volver', { exact: true }).locator('visible=true').click();
            await expect(page.getByText('Datos del objeto').locator('visible=true')).toHaveCount(0);
            await expect(page.getByText('Ver devolución', { exact: true }).locator('visible=true').first()).toBeVisible();
        });

        await caso(128, 'Ver devolución muestra los datos de la persona que retiró el objeto', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await bajarHastaVer(page, titulo);
            await tarjeta.getByText('Ver devolución', { exact: true }).click();
            await expect(page.getByText('Datos de la persona que se llevó el objeto')).toBeVisible();
        });

        await caso(129, 'la devolución muestra foto, DNI, teléfono y fecha y hora', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await expect.soft(page.getByText(dni, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.getByText(telefono, { exact: true }).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.getByText(/Devuelto el .*\d{1,2}[:.]\d{2}/).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.locator('[style*="background-image"]').locator('visible=true').first()).toBeVisible();
        });

        await caso(130, 'Volver desde la devolución regresa a Ver objetos devueltos', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await page.getByText('Volver', { exact: true }).locator('visible=true').click();
            await expect(page.getByText('Datos de la persona que se llevó el objeto').locator('visible=true')).toHaveCount(0);
            await expect(page.getByText('Ver devolución', { exact: true }).locator('visible=true').first()).toBeVisible();
        });

        await caso(131, 'el objeto con foto muestra su foto cargada, no el placeholder', async () => {
            if (!aparece) return noSePudoProbar('el objeto devuelto no aparece en el listado de Ver objetos devueltos');
            await bajarHastaVer(page, titulo);
            const estilo = await imagenDe(tarjeta).getAttribute('style');
            // La foto real viene del almacenamiento; el placeholder es un recurso local de la app.
            expect(estilo).toMatch(/url\("?http/);
            expect(estilo).not.toMatch(/defaultImage/);
        });
    });
});
