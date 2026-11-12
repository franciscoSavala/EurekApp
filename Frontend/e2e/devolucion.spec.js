const { test, expect } = require('@playwright/test');
const { USUARIOS, foto, nombreUnico, abrirComoUsuario, elegirArchivo, irAlMenu, receptarObjeto, bajarHastaVer, cargarListadoCompleto } = require('./helpers');

/** En el inventario, la tarjeta del objeto con ese título (la más cercana que tiene el botón Devolver). */
const tarjeta = (page, titulo) =>
    page.getByText(titulo, { exact: true }).locator("xpath=ancestor::div[.//div[text()='Devolver']][1]");

const cargarFotoDeQuienRetira = (page, archivo) =>
    elegirArchivo(page, () => page.getByText('Seleccionar foto').last().click(), foto(archivo));

// Un DNI distinto en cada corrida: el sistema bloquea al empleado si el mismo DNI retira 3 objetos (fraude).
const dniUnico = () => String(20000000 + Math.floor(Math.random() * 20000000));

test.describe('Devolución de un objeto', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await abrirComoUsuario(browser, USUARIOS.empleado));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 114 y 115: Devolver abre el formulario con foto, DNI, teléfono y email', async () => {
        await irAlMenu(page, 'Ver inventario');
        await page.getByText('Devolver', { exact: true }).first().click();

        await expect(page.getByText('Foto de la persona que se llevará el objeto:')).toBeVisible();
        await expect(page.getByPlaceholder('Ingresa el número de documento')).toBeVisible();
        await expect(page.getByPlaceholder('Ingresa un teléfono de contacto')).toBeVisible();
        await expect(page.getByPlaceholder('Ingresa el email del usuario')).toBeVisible();
        await expect(page.getByText('Registrar devolución', { exact: true })).toBeVisible();
    });

    test('caso 117: sin foto no registra la devolución y con la foto pero sin datos tampoco', async () => {
        await irAlMenu(page, 'Ver inventario');
        await page.getByText('Devolver', { exact: true }).first().click();
        await page.getByPlaceholder('Ingresa el nombre').fill('Ana');
        await page.getByPlaceholder('Ingresa el apellido').fill('Prueba');
        await page.getByPlaceholder('Ingresa el número de documento').fill(dniUnico());
        await page.getByPlaceholder('Ingresa un teléfono de contacto').fill('3514000000');
        await page.getByText('Registrar devolución', { exact: true }).click();
        await expect(page.getByText('La foto es obligatoria.')).toBeVisible();

        await page.getByPlaceholder('Ingresa el nombre').fill('');
        await cargarFotoDeQuienRetira(page, 'persona_retiro.jpg');
        await page.getByText('Registrar devolución', { exact: true }).click();
        await expect(page.getByText('Dato obligatorio.').first()).toBeVisible();
        await expect(page.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
    });

    test('caso 118: un DNI con formato inválido no se acepta', async () => {
        await irAlMenu(page, 'Ver inventario');
        await page.getByText('Devolver', { exact: true }).first().click();
        await cargarFotoDeQuienRetira(page, 'persona_retiro.jpg');
        await page.getByPlaceholder('Ingresa el nombre').fill('Ana');
        await page.getByPlaceholder('Ingresa el apellido').fill('Prueba');
        await page.getByPlaceholder('Ingresa el número de documento').fill('12ab');
        await page.getByPlaceholder('Ingresa un teléfono de contacto').fill('3514000000');
        await page.getByText('Registrar devolución', { exact: true }).click();

        await expect(page.getByText('Número de documento inválido.')).toBeVisible();
        await expect(page.getByText('La devolución del objeto se registró correctamente.')).toHaveCount(0);
    });

    test('casos 116, 121, 122 y 132: devuelve un objeto, sale del inventario y aparece en los devueltos', async () => {
        const titulo = await receptarObjeto(page, nombreUnico('Billetera devolver e2e'));

        await irAlMenu(page, 'Ver inventario');
        await bajarHastaVer(page, titulo);
        await tarjeta(page, titulo).getByText('Devolver', { exact: true }).click();
        await cargarFotoDeQuienRetira(page, 'persona_retiro.jpg');
        await page.getByPlaceholder('Ingresa el nombre').fill('Ana');
        await page.getByPlaceholder('Ingresa el apellido').fill('Prueba');
        await page.getByPlaceholder('Ingresa el número de documento').fill(dniUnico());
        await page.getByPlaceholder('Ingresa un teléfono de contacto').fill('3514000000');
        await page.getByText('Registrar devolución', { exact: true }).click();
        await expect(page.getByText('La devolución del objeto se registró correctamente.')).toBeVisible();

        // Tras registrar, la pantalla queda en el formulario: se vuelve al listado con el botón de volver.
        await page.goBack();
        // La app deja apiladas pantallas anteriores ocultas: solo importa lo que se ve.
        await expect(page.getByText('Devolver', { exact: true }).filter({ visible: true }).first()).toBeVisible();
        // Con el listado completo cargado, para que la ausencia no se deba a una página sin cargar.
        await cargarListadoCompleto(page);
        await expect(page.getByText(titulo, { exact: true }).filter({ visible: true })).toHaveCount(0);

        await irAlMenu(page, 'Ver objetos devueltos');
        await expect(page.getByText(titulo).filter({ visible: true })).toBeVisible();
    });
});
