const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, abrirMenu } = require('./helpers');
const { abrirSesion, iniciarSesionReintentando, abrirMenuDesdeInicio } = require('./helpers/t01');
const { camposPerfil, irAMiPerfil } = require('./helpers/r15');
const { casoContinuo } = require('./helpers/t17');
const T = require('./helpers/t12');

const nombreLargo = 'N'.repeat(51);

/** Intenta cambiar un campo del perfil (0 nombre, 1 apellido, 2 email) y guardar. Falla si el campo no se puede editar. */
async function editarCampo(page, indice, valor) {
    const editar = page.getByText('Editar', { exact: true }).locator('visible=true');
    if (await editar.count()) await editar.first().click();
    const campo = camposPerfil(page).nth(indice);
    await expect(campo, 'el campo no se puede editar').toBeEditable({ timeout: 3000 });
    await campo.fill(valor);
    await page.getByText('Guardar', { exact: true }).locator('visible=true').first().click({ timeout: 5000 });
}

test.describe('Mi perfil', () => {
    test('caso 121: los datos del perfil del empleado no se pueden editar @navegacion @paralelo', async ({ browser }) => {
        test.setTimeout(240_000);
        const email = USUARIOS_PARALELO.empleadoUnc;
        const { context, page } = await abrirSesion(browser, email);
        await irAMiPerfil(page, email);
        await caso(121, 'intentar modificar los campos no cambia nada: son solo lectura', async () => {
            for (let i = 0; i < 3; i++) {
                const campo = camposPerfil(page).nth(i);
                const antes = await campo.getAttribute('placeholder');
                await expect.soft(campo, `el campo ${i + 1} no debería ser editable`).not.toBeEditable();
                await campo.click({ force: true });
                await page.keyboard.type('zzz');
                await expect.soft(campo).toHaveAttribute('placeholder', antes);
            }
        });
        await context.close();
    });

    test('caso 122: los datos del perfil se mantienen al cerrar sesión y volver a entrar @navegacion @paralelo', async ({ page }) => {
        test.setTimeout(300_000);
        const email = USUARIOS_PARALELO.usuarioPedro;
        await iniciarSesionReintentando(page, email);
        const leerPerfil = async () => {
            await irAMiPerfil(page, email);
            return [await camposPerfil(page).nth(0).getAttribute('placeholder'), await camposPerfil(page).nth(1).getAttribute('placeholder'), await camposPerfil(page).nth(2).getAttribute('placeholder')];
        };
        const antes = await leerPerfil();
        await caso(122, 'tras cerrar sesión y volver a ingresar, los datos son los mismos', async () => {
            expect(antes[0].trim(), 'el perfil tiene nombre').not.toBe('');
            await abrirMenu(page);
            await page.getByText('Logout').click();
            await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
            await iniciarSesionReintentando(page, email);
            const despues = await leerPerfil();
            expect(despues).toEqual(antes);
        });
    });

    test('casos 123 y 124: editar nombre y apellido en Mi perfil y que se conserven al volver a entrar @navegacion @paralelo', async ({ browser, request }) => {
        test.setTimeout(240_000);
        // Usuario nuevo: si el perfil se pudiera editar, no se toca el de nadie del seed.
        const u = await T.registrarUsuario(request, 'perfil');
        const { context, page } = await T.abrirComo(browser, u.email);
        try {
            await irAMiPerfil(page, u.email);
            await casoContinuo(123, 'el nombre nuevo se guarda, se ve en Mi perfil y en el menú; un nombre vacío o de más de 50 caracteres se rechaza', async () => {
                const nuevo = 'Nombrenuevo';
                await editarCampo(page, 0, nuevo);
                await expect(page.getByText('¡Datos actualizados!').locator('visible=true').first(), 'no se confirmó el cambio').toBeVisible({ timeout: 15000 });
                await page.reload();
                await irAMiPerfil(page, u.email);
                await expect(camposPerfil(page).nth(0)).toHaveAttribute('placeholder', nuevo);
                await abrirMenuDesdeInicio(page);
                await expect(page.getByText(nuevo).locator('visible=true').first(), 'el nombre nuevo no se ve en el menú').toBeVisible();
                await irAMiPerfil(page, u.email);
                await editarCampo(page, 0, '');
                await expect(page.getByText(/obligatorio|vacío|requerido/i).locator('visible=true').first(), 'un nombre vacío no se rechaza con un mensaje').toBeVisible({ timeout: 3000 });
                await editarCampo(page, 0, nombreLargo);
                await expect(page.getByText(/50|largo|máximo|caracteres/i).locator('visible=true').first(), 'un nombre de más de 50 caracteres no se rechaza con un mensaje').toBeVisible({ timeout: 3000 });
            });
            await casoContinuo(124, 'el apellido nuevo se guarda y se ve en Mi perfil; vacío o de más de 50 se rechaza; el email no se edita', async () => {
                const nuevo = 'Apellidonuevo';
                await irAMiPerfil(page, u.email);
                await editarCampo(page, 1, nuevo);
                await expect(page.getByText('¡Datos actualizados!').locator('visible=true').first(), 'no se confirmó el cambio').toBeVisible({ timeout: 15000 });
                await page.reload();
                await irAMiPerfil(page, u.email);
                await expect(camposPerfil(page).nth(1)).toHaveAttribute('placeholder', nuevo);
                await editarCampo(page, 1, '');
                await expect(page.getByText(/obligatorio|vacío|requerido/i).locator('visible=true').first(), 'un apellido vacío no se rechaza con un mensaje').toBeVisible({ timeout: 3000 });
                await editarCampo(page, 1, nombreLargo);
                await expect(page.getByText(/50|largo|máximo|caracteres/i).locator('visible=true').first(), 'un apellido de más de 50 caracteres no se rechaza con un mensaje').toBeVisible({ timeout: 3000 });
                await expect(camposPerfil(page).nth(2), 'el email no debe poder editarse').not.toBeEditable();
            });
        } finally {
            await context.close();
        }
    });
});
