const { test, expect } = require('@playwright/test');
const { caso, irAlLogin, CLAVE } = require('./helpers');
const { casoContinuo } = require('./helpers/t17');
const { CLAVE_NUEVA, usuarioNuevo, esperarCorreo, codigoDelCorreo, pedirCodigo, cambiarContrasena, vencerCodigo, correosDe, ingresar } = require('./helpers/r01');

const ASUNTO = /Recuperación de contraseña/;
const sigueEnNueva = (page) => expect(page.getByText('Nueva contraseña', { exact: true })).toBeVisible();

test.describe('Recuperación de contraseña', () => {
    test.setTimeout(240_000);

    test('casos 332, 334, 336, 340 y 337: pedir el código, validarlo, reenviarlo y que expire @sesion @paralelo', async ({ page, request }) => {
        const usuario = await usuarioNuevo(request, 'rec');
        await irAlLogin(page);

        let codigo;
        await casoContinuo(332, 'con un email registrado la app pasa a Nueva contraseña y el correo trae un código de 6 dígitos (verificado en el servidor de correo de prueba)', async () => {
            await pedirCodigo(page, usuario.email);
            const correo = await esperarCorreo(request, usuario.email, ASUNTO);
            codigo = codigoDelCorreo(correo);
            expect(codigo, 'el correo debería traer un código de 6 dígitos').toMatch(/^\d{6}$/);
        });

        await casoContinuo(334, 'un código de 6 dígitos distinto al recibido no cambia la contraseña y avisa que es incorrecto', async () => {
            const equivocado = codigo === '000000' ? '111111' : '000000';
            await cambiarContrasena(page, equivocado, CLAVE_NUEVA);
            await expect(page.getByText('El código es incorrecto. Verificá y volvé a intentarlo.')).toBeVisible();
            await sigueEnNueva(page);
        });

        await casoContinuo(336, 'una contraseña corta, una sin símbolo y dos distintas no cambian la contraseña y muestran su mensaje', async () => {
            await cambiarContrasena(page, codigo, 'Ab1!xyz');
            await expect.soft(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
            await cambiarContrasena(page, codigo, 'Abcdefg12');
            await expect.soft(page.getByText('La contraseña debe contener letras, números y al menos un carácter especial (@#$%^&+=!).')).toBeVisible();
            await cambiarContrasena(page, codigo, CLAVE_NUEVA, 'Otra1234!');
            await expect.soft(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
            await sigueEnNueva(page);
        });

        await casoContinuo(340, 'Reenviar código muestra "Código reenviado" y llega un correo nuevo (verificado en el servidor de correo de prueba)', async () => {
            const antes = (await correosDe(request, usuario.email)).filter((m) => ASUNTO.test(m.Subject)).map((m) => m.ID);
            await page.getByText('Reenviar código').click();
            await expect(page.getByText('Código reenviado')).toBeVisible();
            await expect(page.getByText('Revisá tu correo.')).toBeVisible();
            const nuevo = await esperarCorreo(request, usuario.email, ASUNTO, antes);
            expect(nuevo.id).not.toBe(antes[0]);
            codigo = codigoDelCorreo(nuevo);
        });

        await casoContinuo(337, 'un código pedido hace más de 30 minutos no cambia la contraseña y avisa que expiró (vencimiento forzado en la base de prueba)', async () => {
            vencerCodigo(usuario.email);
            await cambiarContrasena(page, codigo, CLAVE_NUEVA);
            await expect(page.getByText('El código expiró. Solicitá uno nuevo.')).toBeVisible();
            await sigueEnNueva(page);
        });
    });

    test('casos 335, 338 y 339: cambiar la contraseña con el código vigente y entrar solo con la nueva @sesion @paralelo', async ({ page, request }) => {
        const usuario = await usuarioNuevo(request, 'cam');
        await irAlLogin(page);
        await pedirCodigo(page, usuario.email);
        const codigo = codigoDelCorreo(await esperarCorreo(request, usuario.email, ASUNTO));

        await casoContinuo(335, 'con el código vigente y una contraseña válida aparece "¡Contraseña cambiada exitosamente!" y a los 2 segundos vuelve al login', async () => {
            await cambiarContrasena(page, codigo, CLAVE_NUEVA);
            await expect(page.getByText('¡Contraseña cambiada exitosamente!')).toBeVisible();
            await expect(page.getByText('Nueva contraseña', { exact: true })).toBeHidden({ timeout: 6000 });
            await expect(page.getByText('¿No tenés cuenta? Registrate')).toBeVisible();
        });

        await casoContinuo(339, 'con la contraseña anterior ya no se puede iniciar sesión', async () => {
            await ingresar(page, usuario.email, CLAVE);
            await expect(page.getByText('Usuario y/o contraseña incorrecta.')).toBeVisible();
            await expect(page.getByText('Logout')).toHaveCount(0);
        });

        await casoContinuo(338, 'con la contraseña nueva se inicia sesión', async () => {
            await irAlLogin(page);
            await ingresar(page, usuario.email, CLAVE_NUEVA);
            await expect(page.getByText('Logout')).toBeVisible();
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
        });
    });
});
