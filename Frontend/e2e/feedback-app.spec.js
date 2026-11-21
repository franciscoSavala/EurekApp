// Opinión de usabilidad sobre la app, desde Mi perfil (casos 125 a 132).
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, nombreUnico, irAlMenu } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const t05 = require('./helpers/t05');

test.describe('Opinión sobre la app', () => {
    test('casos 125, 130, 126, 127, 128 y 131: el modal, sus controles y omitir sin guardar @feedback @paralelo', async ({ browser }) => {
        const { context, page } = await abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
        const envios = [];
        page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/usability-feedback')) envios.push(r); });
        try {
            await test.step('caso 125: desde Mi perfil se abre el modal con estrellas, aspectos, comentario y botones', async () => {
                await t05.abrirModalFeedback(page);
                await expect(page.getByText('¿Cómo fue tu experiencia?')).toBeVisible();
                expect(await t05.estrellas(page).count()).toBe(5);
                for (const a of t05.ASPECTOS) await expect.soft(page.getByText(a, { exact: true })).toBeVisible();
                await expect.soft(page.getByPlaceholder('Comentario opcional...')).toBeVisible();
                await expect.soft(t05.botonEnviar(page)).toBeVisible();
                await expect.soft(t05.botonOmitir(page)).toBeVisible();
            });

            await test.step('caso 130: sin estrellas el botón Enviar permanece deshabilitado y no envía nada', async () => {
                expect(await t05.botonDeshabilitado(page, 'Enviar')).toBe(true);
                await t05.botonEnviar(page).click({ force: true });
                await page.waitForTimeout(500);
                expect(envios.length).toBe(0);
                await expect(page.getByText('¡Gracias por tu retroalimentación!')).toHaveCount(0);
            });

            await test.step('caso 126: elegir estrellas las marca visualmente y habilita Enviar', async () => {
                for (const n of [3, 5, 1, 3]) {
                    await t05.estrellas(page).nth(n - 1).click();
                    expect(await t05.estrellasMarcadas(page)).toBe(n);
                }
                expect(await t05.botonDeshabilitado(page, 'Enviar')).toBe(false);
            });

            await test.step('caso 127: se pueden marcar varios aspectos a la vez y al tocar uno marcado se desmarca', async () => {
                await page.getByText('Facilidad de uso', { exact: true }).click();
                expect(await t05.aspectoActivo(page, 'Facilidad de uso')).toBe(true);
                expect(await t05.aspectoActivo(page, 'Navegación')).toBe(false);
                await page.getByText('Navegación', { exact: true }).click();
                expect(await t05.aspectoActivo(page, 'Facilidad de uso')).toBe(true);
                expect(await t05.aspectoActivo(page, 'Navegación')).toBe(true);
                // Con todos marcados no hay error y se pueden quitar.
                for (const a of t05.ASPECTOS) {
                    if (!(await t05.aspectoActivo(page, a))) await page.getByText(a, { exact: true }).click();
                }
                for (const a of t05.ASPECTOS) expect(await t05.aspectoActivo(page, a)).toBe(true);
                await page.getByText('Facilidad de uso', { exact: true }).click();
                expect(await t05.aspectoActivo(page, 'Facilidad de uso')).toBe(false);
                expect(await t05.aspectoActivo(page, 'Navegación')).toBe(true);
                await expect(page.getByText('¿Cómo fue tu experiencia?')).toBeVisible();
            });

            await test.step('caso 128: el comentario opcional acepta texto libre', async () => {
                const texto = 'Texto libre con ñ, tildes y números 123 !?';
                const campo = page.getByPlaceholder('Comentario opcional...');
                await campo.fill(texto);
                await expect(campo).toHaveValue(texto);
            });

            await test.step('caso 131: Omitir cierra el modal sin guardar nada', async () => {
                await t05.botonOmitir(page).click();
                await expect(page.getByText('¿Cómo fue tu experiencia?')).toHaveCount(0);
                await page.waitForTimeout(500);
                expect(envios.length).toBe(0);
                await expect(page.getByText(t05.BOTON_FEEDBACK, { exact: true }).locator('visible=true')).toBeVisible();
            });
        } finally {
            await context.close();
        }
    });

    test('casos 129 y 132: enviar la opinión completa, cierre del modal y registro en el reporte del administrador @feedback @paralelo', async ({ browser, request }) => {
        const comentario = nombreUnico('Opinion e2e');
        const { context, page } = await abrirComo(browser, USUARIOS_PARALELO.usuarioPedro);
        const envios = [];
        page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/usability-feedback')) envios.push(r.postDataJSON()); });
        try {
            await t05.abrirModalFeedback(page);

            await test.step('caso 129: con estrellas, aspectos y comentario Enviar registra la opinión, agradece y el modal se cierra solo', async () => {
                await t05.estrellas(page).nth(3).click();
                await page.getByText('Claridad de interfaz', { exact: true }).click();
                await page.getByText('Navegación', { exact: true }).click();
                await page.getByPlaceholder('Comentario opcional...').fill(comentario);
                const respuesta = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/usability-feedback'));
                await t05.botonEnviar(page).click();
                const envio = await respuesta;
                expect(envio.status()).toBeLessThan(300);
                await expect(page.getByText('¡Gracias por tu retroalimentación!')).toBeVisible();
                await expect(page.getByText('¡Gracias por tu retroalimentación!')).toHaveCount(0, { timeout: 6000 });
                await expect(page.getByText('¿Cómo fue tu experiencia?')).toHaveCount(0);
                expect(envios).toHaveLength(1);
                expect(envios[0].starRating).toBe(4);
                expect([...envios[0].aspects].sort()).toEqual(['CLARIDAD', 'NAVEGACION']);
                expect(envios[0].comment).toBe(comentario);
            });

            await test.step('caso 129: con solo estrellas también se puede enviar, sin completar otros campos', async () => {
                await t05.abrirModalFeedback(page);
                await t05.estrellas(page).nth(2).click();
                await t05.botonEnviar(page).click();
                await expect(page.getByText('¡Gracias por tu retroalimentación!')).toBeVisible();
                await expect.poll(() => envios.length).toBe(2);
                expect(envios[1].starRating).toBe(3);
                expect(envios[1].aspects).toEqual([]);
                expect(envios[1].comment).toBeNull();
            });
        } finally {
            await context.close();
        }

        await test.step('caso 132: el administrador ve la opinión en el reporte de feedback de usabilidad con sus estrellas y su comentario', async () => {
            const { context: ctx, page: admin } = await abrirComo(browser, 'soporte.eurekapp@gmail.com');
            try {
                await irAlMenu(admin, 'Opiniones sobre la app');
                await expect(admin.getByText('Comentarios de usuarios')).toBeVisible({ timeout: 30000 });
                const fila = admin.getByText(comentario, { exact: true }).locator('visible=true').first().locator('xpath=..');
                await expect(fila).toBeVisible();
                await expect(fila.getByText('★★★★', { exact: true })).toBeVisible();
            } finally {
                await ctx.close();
            }
            // En el servidor: la opinión también figura en el registro, con su contexto y sin organización.
            const login = await request.post(`${t05.URL_BACK}/login`, { data: { username: 'soporte.eurekapp@gmail.com', password: 'Eurekapp1!' } });
            const { token } = await login.json();
            const dia = 86400000;
            const desde = new Date(Date.now() - 2 * dia).toISOString().slice(0, 10);
            const hasta = new Date(Date.now() + 2 * dia).toISOString().slice(0, 10);
            const r = await request.get(`${t05.URL_BACK}/usability-feedback/records?from=${desde}&to=${hasta}`, { headers: { Authorization: `Bearer ${token}` } });
            expect(r.ok()).toBe(true);
            const registro = (await r.json()).find((x) => x.comment === comentario);
            expect(registro, 'el reporte del administrador tiene la opinión enviada').toBeTruthy();
            expect(registro.star_rating).toBe(4);
        });
    });
});
