const { test, expect } = require('@playwright/test');
const { USUARIOS, nombreUnico } = require('./helpers');
const { casoContinuo: caso } = require('./helpers/t17');
const { sesionDe } = require('./helpers/sesion');
const t = require('./helpers/t13');
const { correoPara } = require('./helpers/r04');

const { visible } = t;

/** Registra por la API una búsqueda del usuario que ya apunta al objeto encontrado (queda "Por retirar"). */
async function buscarYReclamar(request, token, descripcion, uuid) {
    const r = await request.post(`${t.URL_BACK}/lost-objects`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { description: descripcion, organization_id: String(t.ORG_UTN), matched_object_uuid: uuid },
    });
    if (!r.ok()) throw new Error(`buscar: ${r.status()} ${await r.text()}`);
}

test.describe('Confirmación de la devolución para el usuario', () => {
    test.setTimeout(300_000);

    test('casos 100, 101 y 102: avisos y estado del usuario cuando se devuelve su objeto @devolucion @serie', async ({ browser, request }) => {
        // Usuario con cuenta del seed (el cupo de registros nuevos del servidor es compartido).
        const email = 'julia@mail.com';
        const usuario = { email, token: (await sesionDe(email)).token };
        const tokenEmp = (await sesionDe(USUARIOS.empleado)).token;
        const sesion = await t.abrirSesionPaciente(browser, usuario.email);
        const pu = sesion.page;
        try {
            // Objeto registrado a nombre del usuario (lo encontró él) y devuelto por el empleado.
            const tituloRegistrado = nombreUnico('Billetera registrada e2e');
            const uuid1 = await t.receptarApi(request, tokenEmp, tituloRegistrado, usuario.email);
            expect((await t.devolverApi(request, tokenEmp, uuid1)).ok()).toBeTruthy();

            await caso(100, 'el usuario que registró el objeto recibe la notificación con fecha de devolución, ve el estado Devuelto y suma sus puntos', async () => {
                await t.irA(pu, 'Notificaciones');
                await expect(visible(pu.getByText('¡Sumaste puntos!')).first()).toBeVisible({ timeout: 15000 });
                await expect.soft(visible(pu.getByText(new RegExp(`${tituloRegistrado}.*10 puntos`)))).toBeVisible();
                await expect.soft(visible(pu.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}.*\d{1,2}[:.]\d{2}/)).first()).toBeVisible();
                expect.soft((await t.logrosApi(request, usuario.token)).xp).toBeGreaterThanOrEqual(10);
                await expect.soft(visible(pu.getByText('Devuelto', { exact: true })).first()).toBeVisible({ timeout: 3000 });
            });

            // El mismo usuario reconoce otro objeto como suyo y la organización se lo entrega.
            const tituloRetirado = nombreUnico('Billetera retirada e2e');
            const uuid2 = await t.receptarApi(request, tokenEmp, tituloRetirado);
            await buscarYReclamar(request, usuario.token, tituloRetirado, uuid2);
            const devolucion = await t.devolverApi(request, tokenEmp, uuid2, { retirador: usuario.email });
            expect(devolucion.ok()).toBeTruthy();

            await caso(101, 'la persona que retira recibe el correo "¡Recuperaste tu objeto! — EurekApp" con el enlace a la encuesta (verificado en el servidor de correo de prueba)', async () => {
                const correo = await correoPara(request, usuario.email, '¡Recuperaste tu objeto! — EurekApp');
                expect(correo, 'no llegó el correo de recuperación').toBeTruthy();
                expect(`${correo.HTML || ''} ${correo.Text || ''}`).toMatch(/OrganizationFeedbackSurvey\?token=/);
            });

            await caso(102, 'en su lista de búsquedas el objeto entregado figura con el estado "Devuelto"', async () => {
                await t.irA(pu, 'Mis búsquedas');
                await expect(visible(pu.getByText(/Buscando|Por retirar|Retirado|Devuelto|Cerrada/)).first()).toBeVisible({ timeout: 15000 });
                await expect(visible(pu.getByText('Devuelto', { exact: true })).first()).toBeVisible({ timeout: 3000 });
            });
        } finally {
            await sesion.context.close();
        }
    });
});
