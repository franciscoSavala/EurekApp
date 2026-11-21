const { test, expect } = require('@playwright/test');
const { caso, irAlLogin, CLAVE } = require('./helpers');
const { irARegistro, ph } = require('./helpers/t01');
const { usuarioNuevo, pedirCodigo, ingresar } = require('./helpers/r01');
const sesion = require('./helpers/sesion');

/** El campo es de tipo password mientras la contraseña está oculta; al mostrarla la web le saca el tipo. */
const tipoDe = async (campo) => ((await campo.getAttribute('type')) === 'password' ? 'password' : 'text');

/** Verifica el ciclo del ojo en un campo: oculta, visible, oculta, sin cambiar el texto escrito. */
async function cicloDelOjo(page, campo, ojoInicial, texto, pantalla) {
    await campo.fill(texto);
    expect.soft(await tipoDe(campo), `${pantalla}: la contraseña debería estar oculta al empezar`).toBe('password');
    await ojoInicial().click();
    expect.soft(await tipoDe(campo), `${pantalla}: al tocar el ojo debería verse`).toBe('text');
    await expect.soft(campo, `${pantalla}: el texto no debería cambiar al mostrarla`).toHaveValue(texto);
    await page.getByRole('button', { name: 'Ocultar contraseña' }).locator('visible=true').first().click();
    expect.soft(await tipoDe(campo), `${pantalla}: al tocar otra vez debería ocultarse`).toBe('password');
    await expect.soft(campo, `${pantalla}: el texto no debería cambiar al ocultarla`).toHaveValue(texto);
}

const ojo = (page) => page.getByRole('button', { name: 'Mostrar contraseña' }).locator('visible=true').first();

test.describe('Acceso: contraseña oculta y cuentas desactivadas', () => {
    test('caso 005: el ojo oculta y muestra la contraseña en login, registro y Nueva contraseña @sesion @paralelo', async ({ page, request }) => {
        const usuario = await usuarioNuevo(request, 'ojo');
        const clave = 'Ojo12345!x';

        await irAlLogin(page);
        await caso(5, 'por defecto la contraseña está oculta, el ojo la muestra y otro toque la oculta sin cambiar el texto (login, registro y Nueva contraseña)', async () => {
            await cicloDelOjo(page, ph(page, 'Contraseña'), () => ojo(page), clave, 'Inicio de sesión');

            await irARegistro(page);
            await cicloDelOjo(page, ph(page, 'Contraseña'), () => ojo(page), clave, 'Registro');

            await irAlLogin(page);
            await pedirCodigo(page, usuario.email);
            const nueva = ph(page, 'Nueva contraseña');
            const confirmar = ph(page, 'Confirmar contraseña');
            await cicloDelOjo(page, nueva, () => ojo(page), clave, 'Nueva contraseña (campo nueva)');
            await cicloDelOjo(page, confirmar, () => page.getByRole('button', { name: 'Mostrar contraseña' }).locator('visible=true').last(), clave, 'Nueva contraseña (campo confirmar)');
        });
    });

    test('caso 006: usuario desactivado y organización suspendida no entran y ven el aviso @sesion @paralelo', async ({ page, request }) => {
        const usuario = await usuarioNuevo(request, 'des', 'Desactivada');
        const admin = await sesion.tokenDe('soporte.eurekapp@gmail.com');
        const lista = await (await request.get(`${sesion.URL_BACK}/admin/users`, { headers: { Authorization: `Bearer ${admin}` } })).json();
        const id = lista.find((u) => u.username === usuario.email).id;
        const fijar = (activo) => request.put(`${sesion.URL_BACK}/admin/users/${id}/active`, { headers: { Authorization: `Bearer ${admin}` }, data: { active: activo } });

        expect((await fijar(false)).status(), 'el administrador desactiva al usuario nuevo').toBeLessThan(300);
        await irAlLogin(page);
        await ingresar(page, usuario.email, CLAVE);
        await caso(6, 'la cuenta desactivada ve el aviso "Cuenta desactivada" y no entra', async () => {
            await expect(page.getByText('Cuenta desactivada', { exact: true })).toBeVisible();
            await expect(page.getByText('Logout')).toHaveCount(0);
            await page.getByText('Entendido', { exact: true }).click();
            await expect(page.getByText('Cuenta desactivada', { exact: true })).toHaveCount(0);
        });

        // La organización suspendida no se puede reproducir sin apagar una organización del seed (estado global):
        // se verifica con el servidor simulado, que responde lo mismo que el servidor real.
        await page.route('**/login', (ruta) => ruta.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'org_deactivated', message: 'Tu organización fue desactivada. Contactá al administrador de EurekApp.', status: 403 }),
        }));
        await irAlLogin(page);
        await ingresar(page, 'owner.utn@eurekapp.com', CLAVE);
        await caso(6, 'la organización suspendida ve el aviso "Organización suspendida" y no entra (verificado con el servidor simulado)', async () => {
            await expect(page.getByText('Organización suspendida', { exact: true })).toBeVisible();
            await expect(page.getByText('Logout')).toHaveCount(0);
        });
    });
});
