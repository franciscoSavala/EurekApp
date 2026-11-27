// EU-424: plazo de pérdidas anteriores de la organización (casos 372 a 375). Contra el servidor real.
// Organización UTN FRC (dueño owner.utn); al terminar la política vuelve a tener el plazo de pérdidas en 90.
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO, abrirComoUsuario } = require('./helpers');
const { casoContinuo: caso } = require('./helpers/t17');
const { sesionDe } = require('./helpers/sesion');
const { URL_BACK, auth, visible, leerPoliticas, abrirPoliticas, botonGuardar, guardar } = require('./helpers/t09');
const T02 = require('./helpers/t02');

const campoPerdidas = (page) => visible(page.getByPlaceholder('90'));

test.describe('Plazo de pérdidas anteriores', () => {
    test.setTimeout(240_000);
    let request;
    let tokenDueno;
    let original;

    const ponerPerdidas = async (dias) => {
        const { history, ...valores } = original;
        const r = await request.put(`${URL_BACK}/organizations/policy`, { headers: auth(tokenDueno), data: { ...valores, maxLostDateDays: dias } });
        expect(r.ok(), `no se pudo guardar el plazo ${dias}`).toBeTruthy();
    };
    const perdidasActual = async () => (await leerPoliticas(request, tokenDueno)).maxLostDateDays;

    test.beforeAll(async ({ playwright }) => {
        request = await playwright.request.newContext();
        tokenDueno = (await sesionDe(USUARIOS.dueno)).token;
        original = await leerPoliticas(request, tokenDueno);
        await ponerPerdidas(90);
    });

    test.afterAll(async () => {
        try { if (tokenDueno) await ponerPerdidas(90); } finally { if (request) await request.dispose(); }
    });

    test('caso 372: plazo de pérdidas anteriores, valor por defecto y valores inválidos @organizacion @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.dueno);
        try {
            await abrirPoliticas(page);
            await caso(372, 'el campo muestra 90; con "1.5", "abc", "0" y vacío avisa el error y no guarda', async () => {
                await expect(campoPerdidas(page)).toHaveValue('90');
                const probar = async (valor, mensaje) => {
                    await campoPerdidas(page).fill(valor);
                    await botonGuardar(page).click();
                    await expect(visible(page.getByText(mensaje, { exact: true }))).toBeVisible();
                    await expect(page.getByText('Políticas guardadas correctamente.')).toHaveCount(0);
                };
                await probar('1.5', 'Ingresá solo números enteros, sin decimales ni letras.');
                await probar('abc', 'Ingresá solo números enteros, sin decimales ni letras.');
                await probar('0', 'El plazo debe ser mayor a cero.');
                await probar('', 'Ingresá la cantidad de días.');
                expect(await perdidasActual(), 'no debe haberse guardado ningún valor inválido').toBe(90);
            });
        } finally {
            await context.close();
        }
    });

    test('caso 373: plazo de pérdidas anteriores, se guarda y se mantiene @organizacion @serie', async ({ browser }) => {
        const { context, page } = await abrirComoUsuario(browser, USUARIOS.dueno);
        try {
            await abrirPoliticas(page);
            await caso(373, 'se guarda 30 y, al salir y volver a entrar a Configurar políticas, sigue en 30', async () => {
                await campoPerdidas(page).fill('30');
                await guardar(page);
                await page.goto('/');
                await expect(page.getByText('Logout')).toBeVisible();
                await abrirPoliticas(page);
                await expect(campoPerdidas(page)).toHaveValue('30');
            });
        } finally {
            await context.close();
            await ponerPerdidas(90);
        }
    });

    test('casos 374 y 375: búsqueda con fecha de pérdida dentro y fuera del plazo @organizacion @serie', async ({ browser }) => {
        await ponerPerdidas(30);
        const { context, page } = await abrirComoUsuario(browser, USUARIOS_PARALELO.usuarioValeria);
        try {
            await caso(375, 'con fecha de hace 31 días aparece "Revisá la fecha de pérdida" con el motivo y la búsqueda no avanza', async () => {
                await T02.prepararBusqueda(page, 'UTN FRC', 31);
                await T02.descripcion(page).fill('Billetera marron de cuero');
                await T02.botonBuscar(page).click();
                await expect(page.getByText('Revisá la fecha de pérdida')).toBeVisible({ timeout: 30000 });
                await expect(page.getByText('Esta organización solo admite registrar pérdidas de hasta 30 días atrás. Elegí una fecha más reciente.')).toBeVisible();
                await expect(page.getByText('Coincidencias encontradas').or(page.getByText('No se encontraron coincidencias para tu búsqueda.'))).toHaveCount(0);
            });
            await caso(374, 'con fecha de hace exactamente 30 días la búsqueda avanza a resultados sin aviso de fecha', async () => {
                await page.goto('/');
                await expect(page.getByText('Logout')).toBeVisible();
                await T02.prepararBusqueda(page, 'UTN FRC', 30);
                await T02.descripcion(page).fill('Billetera marron de cuero');
                await T02.botonBuscar(page).click();
                await T02.esperarResultado(page);
                await expect(page.getByText('Revisá la fecha de pérdida')).toHaveCount(0);
            });
        } finally {
            await context.close();
            await ponerPerdidas(90);
        }
    });
});
