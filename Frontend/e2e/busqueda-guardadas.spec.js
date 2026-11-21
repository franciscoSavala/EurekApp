// Búsquedas guardadas (Mis búsquedas): listado, cierre, estados Por retirar y Retirado, y calificar las coincidencias.
// Las búsquedas y los objetos se preparan por la API; lo que cada caso verifica se mira en la interfaz.
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, nombreUnico } = require('./helpers');
const t = require('./helpers/t02');
const r = require('./helpers/r02');

const MARCA = nombreUnico('r02bg');
const USUARIO = USUARIOS_PARALELO.usuarioValeria;
const esFeedback = (resp) => resp.request().method() === 'POST' && /\/feedback$/.test(resp.url());

/** Abre el detalle de la búsqueda con esa descripción desde la lista de Mis búsquedas. */
const abrirDetalle = async (page, texto) => {
    await r.tarjetaBusqueda(page, texto).locator('visible=true').first().click();
    await expect(page.getByText('Descripción de la búsqueda').locator('visible=true')).toBeVisible();
};

/** Cierra la búsqueda abierta en el detalle respondiendo "Sí" o "No" a ¿Recuperaste tu objeto? */
const cerrarBusqueda = async (page, recupero) => {
    await page.getByText('Cerrar búsqueda', { exact: true }).locator('visible=true').click();
    await expect(page.getByText('¿Recuperaste tu objeto?').locator('visible=true').first()).toBeVisible();
    await page.getByText(recupero ? 'Sí' : 'No', { exact: true }).locator('visible=true').click();
    await expect(page.getByText('Búsqueda cerrada').locator('visible=true')).toBeVisible();
};

test.describe('Búsquedas guardadas', () => {
    let context;
    let page;

    test.beforeEach(async ({ browser }) => {
        ({ context, page } = await t.abrirComo(browser, USUARIO));
    });

    test.afterEach(async () => {
        await context.close();
    });

    // Las búsquedas que dejan estos tests se cierran al terminar.
    test.afterAll(async () => {
        await r.limpiarBusquedas(USUARIO, [MARCA, 'billetera de cuero marron']);
    });

    test('casos 056, 057, 058 y 059: listado, cierre recuperando el objeto, sin recuperarlo y pedido de feedback @busqueda @paralelo', async () => {
        test.setTimeout(300_000);
        const { token } = await r.sesionApi(USUARIO);
        const [busca1, busca2, busca3] = [`${MARCA} mochila azul listado`, `${MARCA} mochila roja sin recuperar`, `${MARCA} mochila verde feedback`];
        await r.conApi(async (request) => {
            for (const d of [busca1, busca2, busca3]) await r.crearBusqueda(request, token, d);
        });
        await r.irAMisBusquedas(page);

        await caso(56, 'Mis búsquedas muestra Búsquedas activas con la búsqueda, su descripción, Registrada con fecha y el estado Buscando', async () => {
            await expect.soft(page.getByText('Búsquedas activas').locator('visible=true')).toBeVisible();
            const tarjeta = r.tarjetaBusqueda(page, busca1).locator('visible=true');
            await expect.soft(tarjeta).toHaveCount(1);
            await expect.soft(tarjeta.getByText(busca1)).toBeVisible();
            await expect.soft(tarjeta.getByText(/Registrada:\s*\d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible();
            await expect.soft(tarjeta.getByText('Buscando', { exact: true })).toBeVisible();
        });

        await caso(57, 'al cerrar la búsqueda y responder que sí, aparece "Búsqueda cerrada" y la búsqueda queda Cerrada con "Sí, lo recuperé"', async () => {
            await abrirDetalle(page, busca1);
            await cerrarBusqueda(page, true);
            await page.getByText('Omitir', { exact: true }).locator('visible=true').click();
            await expect.soft(page.getByText('Búsquedas cerradas').locator('visible=true')).toBeVisible();
            const tarjeta = r.tarjetaBusqueda(page, busca1).locator('visible=true');
            await expect.soft(tarjeta.getByText('Cerrada', { exact: true })).toBeVisible();
            await abrirDetalle(page, busca1);
            await expect.soft(page.getByText('Sí, lo recuperé').locator('visible=true')).toBeVisible();
            await page.getByText('← Volver').locator('visible=true').click();
        });

        await caso(58, 'al cerrar la búsqueda y responder que no, queda Cerrada con "No lo recuperé" y ya no sigue buscando', async () => {
            await abrirDetalle(page, busca2);
            await cerrarBusqueda(page, false);
            await page.getByText('Omitir', { exact: true }).locator('visible=true').click();
            await expect.soft(r.tarjetaBusqueda(page, busca2).locator('visible=true').getByText('Cerrada', { exact: true })).toBeVisible();
            await abrirDetalle(page, busca2);
            await expect.soft(page.getByText('No lo recuperé').locator('visible=true')).toBeVisible();
            await expect.soft(page.getByText('Esta búsqueda está cerrada.', { exact: false }).locator('visible=true')).toBeVisible();
            await expect.soft(page.getByText('Te notificaremos por email cuando encontremos un objeto similar').locator('visible=true')).toHaveCount(0);
            await page.getByText('← Volver').locator('visible=true').click();
        });

        await caso(59, 'al cerrar la búsqueda se ofrece el modal "¿Cómo fue tu experiencia?", se puede omitir y la búsqueda queda cerrada igual', async () => {
            await abrirDetalle(page, busca3);
            await cerrarBusqueda(page, false);
            await expect.soft(page.getByText('¿Cómo fue tu experiencia?').locator('visible=true')).toBeVisible();
            await page.getByText('Omitir', { exact: true }).locator('visible=true').click();
            await expect.soft(page.getByText('¿Cómo fue tu experiencia?')).toHaveCount(0);
            await expect.soft(r.tarjetaBusqueda(page, busca3).locator('visible=true').getByText('Cerrada', { exact: true })).toBeVisible();
            const mia = (await r.conApi((request) => r.misBusquedas(request, token))).find((b) => b.description === busca3);
            expect.soft(mia && mia.status).toBe('CLOSED');
        });
    });

    test('casos 060, 061 y 062: Por retirar, objeto retirado y "No era mi objeto" @busqueda @paralelo', async () => {
        test.setTimeout(300_000);
        const { token } = await r.sesionApi(USUARIO);
        const empleado = USUARIOS_PARALELO.empleadoAero;
        const busquedas = {
            porRetirar: `${MARCA} campera azul por retirar`,
            retirado: `${MARCA} campera azul retirado`,
            otro: `${MARCA} campera azul retirado por otro`,
            noEra: `${MARCA} campera azul no era`,
        };
        await r.conApi(async (request) => {
            const objetos = {};
            for (const clave of Object.keys(busquedas)) {
                const uuidBusqueda = await r.crearBusqueda(request, token, busquedas[clave]);
                const uuidObjeto = await r.receptarPorApi(request, empleado, nombreUnico(`Campera r02 ${clave}`));
                await r.marcarPorRetirar(request, token, uuidBusqueda, uuidObjeto);
                objetos[clave] = uuidObjeto;
            }
            // El objeto se lo lleva la misma persona (Retirado) o alguien sin cuenta (Retirado por alguien más).
            await r.devolverObjeto(request, empleado, objetos.retirado, USUARIO);
            await r.devolverObjeto(request, empleado, objetos.otro);
        });
        await r.irAMisBusquedas(page);

        await caso(60, 'la búsqueda con coincidencia aceptada y retiro pendiente figura como Por retirar', async () => {
            const tarjeta = r.tarjetaBusqueda(page, busquedas.porRetirar).locator('visible=true');
            await expect.soft(tarjeta.getByText('Por retirar', { exact: true })).toBeVisible();
        });

        await caso(61, 'con el objeto retirado figura Retirado (o Retirado por alguien más) y se ofrece cerrar la búsqueda', async () => {
            await expect.soft(r.tarjetaBusqueda(page, busquedas.retirado).locator('visible=true').getByText('Retirado', { exact: true })).toBeVisible();
            await expect.soft(r.tarjetaBusqueda(page, busquedas.otro).locator('visible=true').getByText('Retirado por alguien más', { exact: true })).toBeVisible();
            await abrirDetalle(page, busquedas.retirado);
            await expect.soft(page.getByText('Cerrar búsqueda', { exact: true }).locator('visible=true')).toBeVisible();
            await page.getByText('← Volver').locator('visible=true').click();
            await abrirDetalle(page, busquedas.otro);
            await expect.soft(page.getByText('Cerrar búsqueda', { exact: true }).locator('visible=true')).toBeVisible();
            await page.getByText('← Volver').locator('visible=true').click();
        });

        await caso(62, 'No era mi objeto y Seguir buscando muestran "Seguimos buscando" y la búsqueda vuelve a estar activa', async () => {
            await abrirDetalle(page, busquedas.noEra);
            await page.getByText('No era mi objeto', { exact: true }).locator('visible=true').click();
            await expect.soft(page.getByText('¿El objeto no era tuyo?').locator('visible=true')).toBeVisible();
            await page.getByText('Seguir buscando', { exact: true }).locator('visible=true').click();
            await expect.soft(page.getByText('Seguimos buscando').locator('visible=true')).toBeVisible();
            const tarjeta = r.tarjetaBusqueda(page, busquedas.noEra).locator('visible=true');
            await expect.soft(tarjeta.getByText('Buscando', { exact: true })).toBeVisible();
        });
    });

    test('caso 043: calificar las coincidencias registra la calificación @busqueda @paralelo', async () => {
        const tituloObjeto = nombreUnico('Billetera calificar e2e');
        await r.conApi((request) => r.receptarPorApi(request, USUARIOS_PARALELO.empleadoAero, tituloObjeto));
        await t.prepararBusqueda(page, t.ORG_CON_OBJETOS);
        await t.descripcion(page).fill('billetera de cuero marron');
        await t.botonBuscar(page).click();
        await expect(page.getByText(tituloObjeto, { exact: true })).toBeVisible({ timeout: 30000 });

        await caso(43, 'al elegir una coincidencia, presionar "Este es mi objeto", elegir estrellas y Enviar, se registra la calificación', async () => {
            await page.getByText(tituloObjeto, { exact: true }).click();
            await page.getByText('Este es mi objeto', { exact: true }).click();
            await expect.soft(t.modal(page).getByText('¿Qué tan útiles fueron las coincidencias?')).toBeVisible();
            const estrellas = t.modal(page).locator('div[tabindex="0"]').filter({ hasText: /^[-]$/ });
            expect(await estrellas.count()).toBeGreaterThanOrEqual(5);
            await estrellas.nth(2).click();
            const respuesta = page.waitForResponse(esFeedback);
            await t.modal(page).getByText('Enviar', { exact: true }).click();
            const resp = await respuesta;
            expect.soft(resp.status()).toBeLessThan(300);
            const enviado = resp.request().postDataJSON();
            expect.soft(enviado.starRating).toBe(3);
            expect.soft(enviado.wasFound).toBe(true);
            await expect.soft(page.getByText('Tu objeto está acá. Acercate a retirarlo:', { exact: false })).toBeVisible({ timeout: 30000 });
        });
    });
});
