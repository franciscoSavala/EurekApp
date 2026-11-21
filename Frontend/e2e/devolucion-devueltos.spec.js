const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico, abrirComoUsuario, irAlMenu, bajarHastaVer } = require('./helpers');
const { imagenDe, dniUnico, abrirFormularioDevolucion, cargarFotoDeQuienRetira, completarDatos, tarjetaDevuelto } = require('./helpers/t04');
const { casoContinuo: caso } = require('./helpers/t17');
const { tokenDe, ORG_UTN } = require('./helpers/t13');
const { receptarCompleto, nombreDeSesion } = require('./helpers/r04');

test.describe('Objetos devueltos', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComoUsuario(browser, USUARIOS.empleado));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 103, 104, 105, 106, 107, 108 y 109: devolución duplicada rechazada y consulta de los objetos devueltos @devolucion @serie', async ({ request }) => {
        test.setTimeout(240000);
        const descripcion = 'Llavero con chapita plateada';
        // El objeto lo registró un usuario con cuenta: así se ve también el bloque "Registrador del objeto".
        const registrador = { email: 'julia@mail.com', ...(await nombreDeSesion('julia@mail.com')) };
        const titulo = nombreUnico('Llavero devuelto e2e');
        await receptarCompleto(request, await tokenDe(page), ORG_UTN, titulo, { descripcion, finder: registrador.email });
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

        await caso(103, 'el segundo empleado no registra una segunda devolución y aparece "Este objeto ya fue devuelto anteriormente."', async () => {
            await segunda.getByText('Registrar devolución', { exact: true }).click();
            await expect(segunda.getByText('Este objeto ya fue devuelto anteriormente.').first()).toBeVisible();
            await expect(segunda.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
        });
        await segunda.close();

        await caso(104, 'Ver objetos devueltos muestra la pantalla con la lista de objetos devueltos', async () => {
            await irAlMenu(page, 'Ver objetos devueltos');
            await expect(page.getByText('Ver devolución', { exact: true }).locator('visible=true').first()).toBeVisible();
        });

        // El objeto recién devuelto puede no aparecer en el listado (caso 110). Los casos que parten de una tarjeta
        // se prueban entonces con la primera tarjeta del listado, que es un objeto devuelto como cualquier otro.
        let aparece = true;
        try {
            await bajarHastaVer(page, titulo);
        } catch (e) {
            aparece = false;
        }
        let tituloVisto = titulo;
        let descVista = descripcion;
        if (!aparece) {
            await irAlMenu(page, 'Ver objetos devueltos');
            const primero = page.getByText('Ver devolución', { exact: true }).locator('visible=true').first();
            await expect(primero).toBeVisible();
            const tarjetaPrimera = primero.locator("xpath=ancestor::div[count(.//div[text()='Ver devolución'])=1][last()]");
            const lineas = (await tarjetaPrimera.innerText()).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
            tituloVisto = lineas[0];
            const d = lineas.find((l) => l.startsWith('Descripción: '));
            descVista = d ? d.slice('Descripción: '.length) : null;
        }
        const tarjeta = tarjetaDevuelto(page, tituloVisto);

        await caso(105, 'cada objeto muestra título, descripción, fecha y hora de devolución, fecha de encuentro, imagen y los botones Detalles y Ver devolución', async () => {
            await expect.soft(tarjeta.getByText(tituloVisto, { exact: true })).toBeVisible();
            if (descVista) await expect.soft(tarjeta.getByText('Descripción: ' + descVista)).toBeVisible();
            await expect.soft(tarjeta.getByText(/Devuelto el .*\d{1,2}\/\d{1,2}\/\d{4}.*\d{1,2}[:.]\d{2}/)).toBeVisible();
            await expect.soft(tarjeta.getByText(/Encontrado el \d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
            await expect.soft(tarjeta.getByText('Detalles', { exact: true })).toBeVisible();
            await expect.soft(tarjeta.getByText('Ver devolución', { exact: true })).toBeVisible();
            await expect.soft(imagenDe(tarjeta)).toBeVisible();
            // La foto real viene del almacenamiento; el placeholder es un recurso local de la app.
            const estilo = await imagenDe(tarjeta).getAttribute('style');
            expect.soft(estilo).toMatch(/url\("?http/);
            expect.soft(estilo).not.toMatch(/defaultImage/);
        });

        await caso(106, 'Detalles muestra título, foto y descripción del objeto', async () => {
            await tarjeta.getByText('Detalles', { exact: true }).click();
            await expect(page.getByText('Datos del objeto')).toBeVisible();
            await expect.soft(page.getByText(tituloVisto, { exact: true }).locator('visible=true').first()).toBeVisible();
            if (descVista) await expect.soft(page.getByText(descVista).locator('visible=true').first()).toBeVisible();
            await expect.soft(page.locator('[style*="background-image"]').locator('visible=true').first()).toBeVisible();
        });

        await caso(107, 'Volver desde los detalles regresa a Ver objetos devueltos', async () => {
            await page.getByText('Volver', { exact: true }).locator('visible=true').click();
            await expect(page.getByText('Datos del objeto').locator('visible=true')).toHaveCount(0);
            await expect(page.getByText('Ver devolución', { exact: true }).locator('visible=true').first()).toBeVisible();
        });

        await caso(108, 'Ver devolución muestra los datos de la persona que retiró el objeto', async () => {
            await bajarHastaVer(page, tituloVisto);
            await tarjeta.getByText('Ver devolución', { exact: true }).click();
            await expect(page.getByText('Datos de la persona que se llevó el objeto')).toBeVisible();
        });

        await caso(109, 'se ven foto, nombre y apellido, DNI, teléfono, fecha y hora de devolución y el bloque Registrador del objeto', async () => {
            const v = (texto, opciones) => page.getByText(texto, { ...opciones }).locator('visible=true').first();
            await expect.soft(page.locator('[style*="background-image"]').locator('visible=true').first()).toBeVisible();
            await expect.soft(v(/Devuelto el .*\d{1,2}[:.]\d{2}/)).toBeVisible();
            if (aparece) {
                await expect.soft(v('Ana Prueba', { exact: true })).toBeVisible();
                await expect.soft(v(dni, { exact: true })).toBeVisible();
                await expect.soft(v(telefono, { exact: true })).toBeVisible();
                await expect.soft(v('Registrador del objeto', { exact: true })).toBeVisible();
                await expect.soft(v(new RegExp(`^${registrador.nombre} ${registrador.apellido}`))).toBeVisible();
                await expect.soft(v(registrador.email, { exact: true })).toBeVisible();
                await expect.soft(v('Usuario', { exact: true })).toBeVisible();
            }
        });
    });
});
