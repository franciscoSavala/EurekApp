// Búsqueda sin coincidencias: aviso, volver, calificación, comentario y guardar la búsqueda.
// Se busca en un establecimiento sin objetos (Patio Olmos) para que el resultado sea siempre "sin coincidencias".
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, foto, nombreUnico } = require('./helpers');
const t = require('./helpers/t02');
const r = require('./helpers/r02');

const esGuardado = (resp) => resp.request().method() === 'POST' && /\/lost-objects(\?|$)/.test(resp.url());
const esFeedback = (resp) => resp.request().method() === 'POST' && /\/feedback$/.test(resp.url());
const MARCA = nombreUnico('r02sc');

test.describe('Búsqueda sin coincidencias', () => {
    let context;
    let page;

    test.afterEach(async () => {
        await context.close();
    });

    // Las búsquedas que guardan estos tests se cierran al terminar para no acumular búsquedas activas.
    test.afterAll(async () => {
        await r.limpiarBusquedas(USUARIOS_PARALELO.usuarioPedro, [MARCA]);
        await r.limpiarBusquedas(USUARIOS_PARALELO.usuarioValeria, [MARCA]);
    });

    test('casos 040, 041 y 042: aviso, calificación con comentario y volver @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        await t.buscarSinResultados(page, `${MARCA} billetera negra de cuero feedback`);

        await caso(40, 'sin objetos coincidentes se muestra el mensaje de que todavía no fue encontrado', async () => {
            await expect.soft(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toBeVisible();
            await expect.soft(page.getByText('Puede que tu objeto no haya sido encontrado todavía.')).toBeVisible();
        });

        await caso(42, 'Enviar calificación aparece al elegir estrellas y, al enviarlo, la calificación con el comentario queda registrada', async () => {
            await expect.soft(page.getByText('¿Qué tan útil fue la búsqueda?')).toBeVisible();
            await expect.soft(page.getByText('Enviar calificación', { exact: true }), 'el botón aparece antes de elegir estrellas').toHaveCount(0);
            const comentario = page.getByPlaceholder('Comentario opcional...');
            await comentario.fill('La búsqueda fue clara pero no apareció mi objeto');
            await expect.soft(comentario).toHaveValue('La búsqueda fue clara pero no apareció mi objeto');
            // Las estrellas son cinco botones de ícono (su único texto es un carácter de la fuente de íconos).
            const estrellas = page.locator('div[tabindex="0"]').filter({ hasText: /^[-]$/ });
            expect(await estrellas.count()).toBeGreaterThanOrEqual(5);
            await estrellas.nth(3).click();
            await expect.soft(page.getByText('Enviar calificación', { exact: true })).toBeVisible();
            const respuesta = page.waitForResponse(esFeedback);
            await page.getByText('Enviar calificación', { exact: true }).click();
            const resp = await respuesta;
            expect.soft(resp.status()).toBeLessThan(300);
            const enviado = resp.request().postDataJSON();
            expect.soft(enviado.starRating).toBe(4);
            expect.soft(enviado.comment).toBe('La búsqueda fue clara pero no apareció mi objeto');
            await expect.soft(page.getByText('¡Gracias por tu calificación!')).toBeVisible();
        });

        await caso(41, 'Volver regresa a la pantalla de búsqueda', async () => {
            await page.getByText('← Volver').click();
            await expect.soft(t.descripcion(page)).toBeVisible();
            await expect.soft(t.botonBuscar(page)).toBeVisible();
        });
    });

    test('caso 052: el modal de guardar la búsqueda, con y sin foto @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        await t.buscarSinResultados(page, `${MARCA} billetera negra modal`);

        await caso(52, 'el modal pregunta si se quiere guardar y ofrece Cerrar; sin foto recomienda adjuntar una y ofrece Adjuntar foto y guardar y Guardar sin foto', async () => {
            await expect.soft(page.getByText('¿No encontraste tu objeto?')).toBeVisible();
            await page.getByText('Guardar búsqueda', { exact: true }).click();
            await expect.soft(t.modal(page).getByText('¿Quieres guardar tu búsqueda? Te avisaremos cuando encontremos un objeto similar.')).toBeVisible();
            await expect.soft(t.modal(page).getByText('Cerrar', { exact: true })).toBeVisible();
            await expect.soft(t.modal(page).getByText(/Te recomendamos adjuntar una foto/)).toBeVisible();
            await expect.soft(t.modal(page).getByText('Adjuntar foto y guardar', { exact: true })).toBeVisible();
            await expect.soft(t.modal(page).getByText('Guardar sin foto', { exact: true })).toBeVisible();
            await t.modal(page).getByText('Cerrar', { exact: true }).click();
            await expect.soft(t.modal(page)).toHaveCount(0);
        });

        await caso(52, 'si la búsqueda tenía foto, el modal ofrece Guardar búsqueda y Cerrar', async () => {
            await t.buscarSinResultados(page, `${MARCA} zapatillas rojas modal`, foto('reemplazo_zapatilla.jpg'));
            await page.getByText('Guardar búsqueda', { exact: true }).click();
            await expect.soft(t.modal(page).getByText('¿Quieres guardar tu búsqueda? Te avisaremos cuando encontremos un objeto similar.')).toBeVisible();
            await expect.soft(t.modal(page).getByText('Guardar búsqueda', { exact: true })).toBeVisible();
            await expect.soft(t.modal(page).getByText('Cerrar', { exact: true })).toBeVisible();
            await expect.soft(t.modal(page).getByText('Adjuntar foto y guardar', { exact: true })).toHaveCount(0);
            await t.modal(page).getByText('Cerrar', { exact: true }).click();
            await expect.soft(t.modal(page)).toHaveCount(0);
        });
    });

    test('casos 053 y 054: guardar una búsqueda con foto y cerrar el modal sin guardar @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioValeria));
        // Con foto, el modal ofrece exactamente "Guardar búsqueda" y "Cerrar".
        const abrirModal = async (texto) => {
            await t.buscarSinResultados(page, texto, foto('reemplazo_zapatilla.jpg'));
            await page.getByText('Guardar búsqueda', { exact: true }).click();
            await expect(t.modal(page).getByText(/¿Quieres guardar tu búsqueda\?/)).toBeVisible();
        };

        const paraCerrar = `${MARCA} zapatillas rojas cerrar`;
        await abrirModal(paraCerrar);
        let guardados = 0;
        page.on('request', (req) => { if (req.method() === 'POST' && /\/lost-objects(\?|$)/.test(req.url())) guardados++; });

        await caso(54, 'Cerrar cierra el modal sin guardar la búsqueda', async () => {
            await t.modal(page).getByText('Cerrar', { exact: true }).click();
            await expect.soft(t.modal(page)).toHaveCount(0);
            await page.waitForTimeout(1500);
            expect.soft(guardados, 'se guardó la búsqueda al cerrar').toBe(0);
        });

        const paraGuardar = `${MARCA} zapatillas rojas guardar`;
        await abrirModal(paraGuardar);
        await caso(53, 'Guardar búsqueda confirma el guardado, cierra el modal y abre Mis búsquedas con la búsqueda en estado Buscando', async () => {
            const respuesta = page.waitForResponse(esGuardado);
            await t.modal(page).getByText('Guardar búsqueda', { exact: true }).click();
            expect.soft((await respuesta).status()).toBeLessThan(300);
            await expect.soft(page.getByText('¡Búsqueda guardada correctamente!')).toBeVisible();
            await expect.soft(t.modal(page)).toHaveCount(0, { timeout: 10000 });
            await expect.soft(page.getByText('Búsquedas activas').locator('visible=true')).toBeVisible({ timeout: 15000 });
            const tarjeta = r.tarjetaBusqueda(page, paraGuardar).locator('visible=true');
            await expect.soft(tarjeta).toHaveCount(1, { timeout: 15000 });
            await expect.soft(tarjeta.getByText('Buscando', { exact: true })).toBeVisible();
        });
    });

    test('caso 055: guardar dos veces la misma búsqueda deja dos búsquedas en Mis búsquedas @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioPedro));
        const texto = `${MARCA} zapatillas azules repetida`;
        const guardarUnaVez = async () => {
            await t.buscarSinResultados(page, texto, foto('reemplazo_zapatilla.jpg'));
            await page.getByText('Guardar búsqueda', { exact: true }).click();
            const respuesta = page.waitForResponse(esGuardado);
            await t.modal(page).getByText('Guardar búsqueda', { exact: true }).click();
            await respuesta;
            await expect(page.getByText('¡Búsqueda guardada correctamente!')).toBeVisible();
            await expect(r.tarjetaBusqueda(page, texto).locator('visible=true').first()).toBeVisible({ timeout: 15000 });
        };
        await guardarUnaVez();
        await guardarUnaVez();

        await caso(55, 'en Mis búsquedas figuran las dos búsquedas, cada una con su fecha de Registrada y el estado Buscando', async () => {
            const tarjetas = r.tarjetaBusqueda(page, texto).locator('visible=true');
            await expect.soft(tarjetas).toHaveCount(2);
            for (let i = 0; i < await tarjetas.count(); i++) {
                await expect.soft(tarjetas.nth(i).getByText(/Registrada:\s*\d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
                await expect.soft(tarjetas.nth(i).getByText('Buscando', { exact: true })).toBeVisible();
            }
        });
    });

    test('caso 063: el doble clic en Guardar búsqueda guarda una sola búsqueda @busqueda @paralelo', async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIOS_PARALELO.usuarioValeria));
        const texto = `${MARCA} zapatillas doble clic`;
        await t.buscarSinResultados(page, texto, foto('reemplazo_zapatilla.jpg'));
        await page.getByText('Guardar búsqueda', { exact: true }).click();
        await expect(t.modal(page).getByText('Guardar búsqueda', { exact: true })).toBeVisible();
        let guardados = 0;
        page.on('request', (req) => { if (req.method() === 'POST' && /\/lost-objects(\?|$)/.test(req.url())) guardados++; });

        await caso(63, 'mientras se guarda desaparecen los botones de guardar, solo queda Cerrar, y en Mis búsquedas figura una sola búsqueda nueva', async () => {
            const boton = t.modal(page).getByText('Guardar búsqueda', { exact: true });
            await boton.click();
            // El segundo clic inmediato no encuentra el botón: ya no está.
            await boton.click({ timeout: 700 }).catch(() => {});
            await expect.soft(boton).toHaveCount(0);
            await expect.soft(t.modal(page).getByText('Adjuntar foto y guardar', { exact: true })).toHaveCount(0);
            await expect.soft(t.modal(page).getByText('Guardar sin foto', { exact: true })).toHaveCount(0);
            await expect.soft(t.modal(page).getByText('Cerrar', { exact: true })).toBeVisible();
            await expect.soft(page.getByText('Búsquedas activas').locator('visible=true')).toBeVisible({ timeout: 15000 });
            expect.soft(guardados, 'se mandó más de un pedido de guardado').toBe(1);
            await expect.soft(r.tarjetaBusqueda(page, texto).locator('visible=true')).toHaveCount(1);
        });
    });
});
