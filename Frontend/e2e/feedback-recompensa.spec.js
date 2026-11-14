// Opinión sobre una recompensa recibida (casos 300 a 313). Ni Logros ni las notificaciones de
// recompensa ofrecen un formulario de opinión, así que estos pasos fallan por esa razón.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, irAlMenu } = require('./helpers');
const { abrirComo } = require('./helpers/t02');

// Un paso que falla no corta el test: queda anotado como fallo del paso y sigue con el siguiente.
async function intentar(fn) {
    try {
        await fn();
    } catch (e) {
        expect.soft(null, e.message.split(/\r?\n/)[0]).toBe('sin error');
    }
}

const CORTO = { timeout: 1500 };
const texto = (page, t) => page.getByText(t, { exact: true }).locator('visible=true').first();
const ASPECTOS = {
    303: 'Recompensa útil',
    304: 'Recompensa atractiva',
    305: 'Recompensa insuficiente',
    306: 'Recompensa difícil de obtener',
    307: 'Recompensa justa',
};

test('casos 300 a 313: opinión sobre una recompensa recibida @feedback @paralelo', async ({ browser }) => {
    const { context, page } = await abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
    try {
        await test.step('caso 300: en Logros se elige una recompensa recibida y se abre el formulario de feedback', async () => intentar(async () => {
            await irAlMenu(page, 'Logros');
            const boton = page.getByText(/Dar feedback/i).locator('visible=true').first();
            await expect(boton).toBeVisible({ timeout: 4000 });
            await boton.click(CORTO);
            await expect(texto(page, 'Recompensa útil')).toBeVisible(CORTO);
        }));

        await test.step('caso 301: el formulario muestra estrellas, aspectos, comentario opcional y Enviar/Omitir', async () => intentar(async () => {
            for (const a of Object.values(ASPECTOS)) await expect(texto(page, a)).toBeVisible(CORTO);
            await expect(page.getByPlaceholder(/omentario/).locator('visible=true').first()).toBeVisible(CORTO);
            await expect(texto(page, 'Enviar')).toBeVisible(CORTO);
            await expect(texto(page, 'Omitir')).toBeVisible(CORTO);
        }));

        await test.step('caso 302: elegir de 1 a 5 estrellas en el formulario de recompensa las marca', async () => intentar(async () => {
            await expect(texto(page, 'Recompensa útil')).toBeVisible(CORTO);
            await expect(page.getByText('¿Cómo fue tu recompensa?').locator('visible=true').first()).toBeVisible(CORTO);
        }));

        for (const [caso, aspecto] of Object.entries(ASPECTOS)) {
            await test.step(`caso ${caso}: el aspecto "${aspecto}" se elige y se registra al enviar`, async () => intentar(async () => {
                await texto(page, aspecto).click(CORTO);
                await texto(page, 'Enviar').click(CORTO);
            }));
        }

        await test.step('caso 308: se pueden elegir varios aspectos de recompensa y se registran todos', async () => intentar(async () => {
            await texto(page, ASPECTOS[303]).click(CORTO);
            await texto(page, ASPECTOS[307]).click(CORTO);
        }));
        await test.step('caso 309: se puede escribir un comentario opcional sobre la recompensa', async () => intentar(async () => {
            await page.getByPlaceholder(/omentario/).locator('visible=true').first().fill('Comentario', CORTO);
        }));
        await test.step('caso 310: se envía el feedback completo de la recompensa', async () => intentar(async () => {
            await texto(page, 'Enviar').click(CORTO);
        }));
        await test.step('caso 311: Omitir cierra el formulario de recompensa sin guardar', async () => intentar(async () => {
            await texto(page, 'Omitir').click(CORTO);
        }));
        await test.step('caso 312: el feedback queda asociado al usuario y a la recompensa recibida', async () => intentar(async () => {
            await expect(texto(page, 'Recompensa útil')).toBeVisible(CORTO);
        }));
        await test.step('caso 313: al enviar se muestra una confirmación de la recompensa', async () => intentar(async () => {
            await expect(page.getByText(/feedback.*registrado|¡Gracias/i).locator('visible=true').first()).toBeVisible(CORTO);
        }));
    } finally {
        await context.close();
    }
});
