const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO, caso, abrirMenu } = require('./helpers');
const { abrirSesion, iniciarSesionReintentando, entrarPorMenu, verificarPantalla } = require('./helpers/t01');

/** Los tres campos de datos personales del perfil (nombre, apellido y email): la app muestra el dato como texto del campo. */
const camposPerfil = (page) => page.locator('input:visible');

test.describe('Mi perfil', () => {
    test('casos 143, 144 y 145: el perfil del empleado muestra sus datos y no se pueden editar @navegacion @paralelo', async ({ browser }) => {
        const email = USUARIOS_PARALELO.empleadoUnc;
        const { context, page } = await abrirSesion(browser, email);
        await caso(143, 'desde el menú, Mi perfil muestra los datos del usuario', async () => {
            const entro = await entrarPorMenu(page, 'Mi perfil');
            expect(entro).toBe(true);
            await verificarPantalla(page, 'Mi perfil');
            await expect(page.getByText('Nombre:')).toBeVisible();
            await expect(camposPerfil(page).nth(2)).toHaveAttribute('placeholder', email);
        });
        await caso(144, 'se ven nombre, apellido, email, tipo de usuario y organización', async () => {
            await expect.soft(page.getByText('Apellido:')).toBeVisible();
            await expect.soft(page.getByText('Email:')).toBeVisible();
            const nombre = await camposPerfil(page).nth(0).getAttribute('placeholder');
            const apellido = await camposPerfil(page).nth(1).getAttribute('placeholder');
            expect.soft(nombre.trim(), 'nombre del usuario').not.toBe('');
            expect.soft(apellido.trim(), 'apellido del usuario').not.toBe('');
            await expect.soft(page.getByText('Tipo de usuario:')).toBeVisible();
            await expect.soft(page.getByText('Empleado de organización')).toBeVisible();
            await expect.soft(page.getByText(/Organización:/)).toBeVisible();
        });
        await caso(145, 'los datos personales no se pueden modificar', async () => {
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

    test('caso 146: los datos del perfil se mantienen al cerrar sesión y volver a entrar @navegacion @paralelo', async ({ page }) => {
        const email = USUARIOS_PARALELO.usuarioPedro;
        await iniciarSesionReintentando(page, email);
        const leerPerfil = async () => {
            await entrarPorMenu(page, 'Mi perfil');
            await expect(page.getByText('Nombre:')).toBeVisible();
            await expect(camposPerfil(page).nth(2)).toHaveAttribute('placeholder', email);
            return [await camposPerfil(page).nth(0).getAttribute('placeholder'), await camposPerfil(page).nth(1).getAttribute('placeholder'), await camposPerfil(page).nth(2).getAttribute('placeholder')];
        };
        const antes = await leerPerfil();
        await caso(146, 'tras cerrar sesión y volver a ingresar, los datos son los mismos', async () => {
            expect(antes[0].trim(), 'el perfil tiene nombre').not.toBe('');
            await abrirMenu(page);
            await page.getByText('Logout').click();
            await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
            await iniciarSesionReintentando(page, email);
            const despues = await leerPerfil();
            expect(despues).toEqual(antes);
        });
    });
});
