// Búsqueda sin coincidencias: aviso, volver, calificación, comentario y guardar la búsqueda.
// Se busca en un establecimiento sin objetos (Patio Olmos) para que el resultado sea siempre "sin coincidencias".
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, foto, nombreUnico } = require('./helpers');
const t = require('./helpers/t02');

const esGuardado = (r) => r.request().method() === 'POST' && /\/lost-objects(\?|$)/.test(r.url());
// El texto de una búsqueda guardada tal como lo muestra la lista Mis búsquedas (no el campo de la pantalla de búsqueda).
const enLista = (page, texto) => page.locator('div[dir="auto"]', { hasText: texto });
const esFeedback = (r) => r.request().method() === 'POST' && /\/feedback$/.test(r.url());

test.describe('Búsqueda sin coincidencias', () => {
    let context;
    let page;

    test.afterEach(async () => {
        await context.close();
    });

    test('casos 055, 056, 057 y 058: aviso, comentario, calificación y volver @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        const texto = nombreUnico('billetera negra de cuero feedback');
        await t.buscarSinResultados(page, texto);

        await caso(55, 'sin objetos coincidentes se muestra el mensaje de que todavía no fue encontrado', async () => {
            await expect.soft(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toBeVisible();
            await expect.soft(page.getByText('Puede que tu objeto no haya sido encontrado todavía.')).toBeVisible();
        });

        const comentario = page.getByPlaceholder('Comentario opcional...');
        await caso(58, 'se puede escribir un comentario sobre la búsqueda', async () => {
            await comentario.fill('La búsqueda fue clara pero no apareció mi objeto');
            await expect.soft(comentario).toHaveValue('La búsqueda fue clara pero no apareció mi objeto');
        });

        await caso(57, 'al elegir estrellas y enviar, la calificación queda registrada', async () => {
            await expect.soft(page.getByText('¿Qué tan útil fue la búsqueda?')).toBeVisible();
            // Las estrellas son cinco botones de ícono (su único texto es un carácter de la fuente de íconos).
            const estrellas = page.locator('div[tabindex="0"]').filter({ hasText: /^[-]$/ });
            expect(await estrellas.count()).toBeGreaterThanOrEqual(5);
            await estrellas.nth(3).click();
            const respuesta = page.waitForResponse(esFeedback);
            await page.getByText('Enviar calificación', { exact: true }).click();
            const r = await respuesta;
            expect.soft(r.status()).toBeLessThan(300);
            const enviado = r.request().postDataJSON();
            expect.soft(enviado.starRating).toBe(4);
            expect.soft(enviado.comment).toBe('La búsqueda fue clara pero no apareció mi objeto');
            await expect.soft(page.getByText('¡Gracias por tu calificación!')).toBeVisible();
        });

        await caso(56, 'Volver regresa a la pantalla de búsqueda', async () => {
            await page.getByText('← Volver').click();
            await expect.soft(t.descripcion(page)).toBeVisible();
            await expect.soft(t.botonBuscar(page)).toBeVisible();
        });
    });

    test('casos 070 y 075: el modal de guardar la búsqueda y sus botones @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        await t.buscarSinResultados(page, nombreUnico('billetera negra modal'));
        await page.getByText('Guardar búsqueda', { exact: true }).click();

        await caso(70, 'el modal pregunta si se quiere guardar y ofrece Guardar búsqueda y Cerrar', async () => {
            await expect.soft(t.modal(page).getByText(/¿Quieres guardar tu búsqueda\?/)).toBeVisible();
            await expect.soft(t.modal(page).getByText('Guardar búsqueda', { exact: true }), 'el modal no ofrece "Guardar búsqueda" sin foto').toBeVisible({ timeout: 2000 });
            await expect.soft(t.modal(page).getByText('Cerrar', { exact: true })).toBeVisible();
        });

        await caso(75, 'se ven Guardar búsqueda y Cerrar, y los dos funcionan', async () => {
            await expect.soft(t.modal(page).getByText('Guardar búsqueda', { exact: true }), 'el modal no ofrece "Guardar búsqueda" sin foto').toBeVisible({ timeout: 2000 });
            await t.modal(page).getByText('Cerrar', { exact: true }).click();
            await expect.soft(t.modal(page)).toHaveCount(0);
        });
    });

    test('caso 059: Guardar búsqueda en la pantalla sin coincidencias guarda la búsqueda @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        const texto = nombreUnico('billetera negra guardada');
        await t.buscarSinResultados(page, texto);
        await page.getByText('Guardar búsqueda', { exact: true }).click();

        await caso(59, 'la búsqueda sin coincidencias queda guardada para futuras consultas', async () => {
            // Sin foto el modal ofrece guardar "sin foto".
            const respuesta = page.waitForResponse(esGuardado);
            await t.modal(page).getByText('Guardar sin foto', { exact: true }).click();
            expect.soft((await respuesta).status()).toBeLessThan(300);
            await expect.soft(page.getByText('¡Búsqueda guardada correctamente!')).toBeVisible();
            await expect.soft(enLista(page, texto).first()).toBeVisible({ timeout: 15000 });
        });
    });

    test('casos 071, 072 y 074: guardar y cerrar el modal con una búsqueda con foto @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioValeria));
        // Con foto, el modal ofrece exactamente "Guardar búsqueda" y "Cerrar".
        const abrirModal = async (texto) => {
            await t.buscarSinResultados(page, texto, foto('reemplazo_zapatilla.jpg'));
            await page.getByText('Guardar búsqueda', { exact: true }).click();
            await expect(t.modal(page).getByText(/¿Quieres guardar tu búsqueda\?/)).toBeVisible();
        };

        const paraCerrar = nombreUnico('zapatillas rojas cerrar');
        await abrirModal(paraCerrar);
        let guardados = 0;
        page.on('request', (r) => { if (r.method() === 'POST' && /\/lost-objects(\?|$)/.test(r.url())) guardados++; });

        await caso(72, 'Cerrar cierra el modal sin guardar la búsqueda', async () => {
            await t.modal(page).getByText('Cerrar', { exact: true }).click();
            await expect.soft(t.modal(page)).toHaveCount(0);
            await page.waitForTimeout(1500);
            expect.soft(guardados, 'se guardó la búsqueda al cerrar').toBe(0);
        });

        const paraGuardar = nombreUnico('zapatillas rojas guardar');
        await abrirModal(paraGuardar);
        await caso(71, 'Guardar búsqueda guarda y cierra el modal', async () => {
            const respuesta = page.waitForResponse(esGuardado);
            await t.modal(page).getByText('Guardar búsqueda', { exact: true }).click();
            expect.soft((await respuesta).status()).toBeLessThan(300);
            await expect.soft(page.getByText('¡Búsqueda guardada correctamente!')).toBeVisible();
            await expect.soft(t.modal(page)).toHaveCount(0, { timeout: 10000 });
            await expect.soft(enLista(page, paraGuardar).first()).toBeVisible({ timeout: 15000 });
        });

        const paraCerrarDespues = nombreUnico('zapatillas rojas cerrar despues');
        await abrirModal(paraCerrarDespues);
        await caso(74, 'después de guardar, Cerrar cierra el modal', async () => {
            await t.modal(page).getByText('Guardar búsqueda', { exact: true }).click();
            await expect.soft(page.getByText('¡Búsqueda guardada correctamente!')).toBeVisible();
            if (await t.modal(page).count() > 0) await t.modal(page).getByText('Cerrar', { exact: true }).click();
            await expect.soft(t.modal(page)).toHaveCount(0);
        });
    });

    test('caso 073: guardar dos veces la misma búsqueda no la duplica @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        const texto = nombreUnico('zapatillas azules repetida');
        const guardarUnaVez = async () => {
            await t.buscarSinResultados(page, texto, foto('reemplazo_zapatilla.jpg'));
            await page.getByText('Guardar búsqueda', { exact: true }).click();
            const respuesta = page.waitForResponse(esGuardado);
            await t.modal(page).getByText('Guardar búsqueda', { exact: true }).click();
            await respuesta;
            await expect(enLista(page, texto).first()).toBeVisible({ timeout: 15000 });
            return enLista(page, texto).count();
        };
        const tras1 = await guardarUnaVez();
        const tras2 = await guardarUnaVez();

        await caso(73, 'con una búsqueda igual ya guardada, no queda repetida en Mis búsquedas', async () => {
            const aviso = await page.getByText(/ya (est[aá]|fue|la ten[eé]s).*guardada/i).count();
            expect.soft(aviso > 0 || tras2 === tras1, `la lista pasó de ${tras1} a ${tras2} entradas con la misma búsqueda`).toBe(true);
        });
    });
});
