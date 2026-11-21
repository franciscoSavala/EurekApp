const { test, expect } = require('@playwright/test');
const { caso, irAlLogin, USUARIOS_PARALELO } = require('./helpers');
const { irARegistro, registrate, ph } = require('./helpers/t01');
const { emailNuevo, llenarRegistro, registrarse, esperarCorreo } = require('./helpers/r01');

const MSJ = {
    nombre: 'El nombre es obligatorio.',
    apellido: 'El apellido es obligatorio.',
    email: 'La dirección de email es obligatoria.',
    clave: 'La contraseña es obligatoria.',
    emailInvalido: 'Ingresá un email válido.',
    largo: 'La contraseña debe tener entre 8 y 16 caracteres.',
    simbolo: 'La contraseña debe contener letras, números y al menos un carácter especial (@#$%^&+=!).',
};

/** El usuario sigue en el registro: el formulario se ve y no entró a Buscar un objeto. */
async function sigueEnRegistro(page) {
    await expect(ph(page, 'Nombre')).toBeVisible();
    await expect(page.getByText('Descripción del objeto:')).toHaveCount(0);
}

test.describe('Registro y acceso', () => {
    // El límite de ingresos y registros por minuto es de toda la máquina: los envíos esperan su turno y reintentan.
    test.setTimeout(240_000);

    test('caso 004: de login a registro y de registro a login @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await caso(4, 'el enlace del login abre el registro y "Ya tengo cuenta. Iniciar sesión" vuelve al login', async () => {
            await page.getByText('¿No tenés cuenta? Registrate').click();
            await expect(ph(page, 'Nombre')).toBeVisible();
            await expect(ph(page, 'Apellido')).toBeVisible();
            await expect(registrate(page)).toBeVisible();
            await page.getByText('Ya tengo cuenta. Iniciar sesión').click();
            await expect(ph(page, 'Contraseña')).toBeVisible();
            await expect(ph(page, 'Nombre')).toHaveCount(0);
            await expect(page.getByText('Iniciar sesión', { exact: true }).last()).toBeVisible();
        });
    });

    test('casos 007 y 014: registro exitoso con datos válidos y correo de bienvenida @sesion @paralelo', async ({ page, request }) => {
        const email = emailNuevo('alta');
        await irARegistro(page);
        await llenarRegistro(page, { nombre: 'Alta', apellido: 'Prueba', email });
        await registrarse(page);
        await caso(7, 'registra al usuario y lo lleva a Buscar un objeto', async () => {
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
            await expect(page.getByText('¡Bienvenido, Alta!')).toBeVisible();
        });
        await caso(14, 'llega el correo "¡Bienvenido/a a EurekApp!" (verificado en el servidor de correo de prueba)', async () => {
            const correo = await esperarCorreo(request, email, /Bienvenido\/a a EurekApp/);
            expect(correo.asunto).toContain('¡Bienvenido/a a EurekApp!');
        });
    });

    test('caso 008: con campos obligatorios vacíos no registra y muestra los mensajes @sesion @paralelo', async ({ page }) => {
        await caso(8, 'con todo vacío se ven los cuatro mensajes a la vez y con un solo campo vacío se ve solo el suyo', async () => {
            await irARegistro(page);
            await registrate(page).click();
            for (const m of [MSJ.nombre, MSJ.apellido, MSJ.email, MSJ.clave]) {
                await expect.soft(page.getByText(m), `con todo vacío debería verse: ${m}`).toBeVisible();
            }
            await sigueEnRegistro(page);

            const campos = [
                { vacio: { nombre: null }, ve: MSJ.nombre },
                { vacio: { apellido: null }, ve: MSJ.apellido },
                { vacio: { email: null }, ve: MSJ.email },
                { vacio: { clave: null }, ve: MSJ.clave },
            ];
            for (const { vacio, ve } of campos) {
                // Cada intento parte de un formulario nuevo: el anterior conserva lo cargado.
                await irARegistro(page);
                await llenarRegistro(page, vacio);
                await registrate(page).click();
                await expect.soft(page.getByText(ve), `con un solo campo vacío debería verse: ${ve}`).toBeVisible();
                for (const otro of [MSJ.nombre, MSJ.apellido, MSJ.email, MSJ.clave].filter((m) => m !== ve)) {
                    await expect.soft(page.getByText(otro), `no debería verse: ${otro}`).toHaveCount(0);
                }
                await sigueEnRegistro(page);
            }
        });
    });

    test('caso 009: contraseña de 7 caracteres no registra y avisa el largo @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await llenarRegistro(page, { clave: 'Ab1!xyz' });
        await registrate(page).click();
        await caso(9, 'avisa "La contraseña debe tener entre 8 y 16 caracteres." y no crea la cuenta', async () => {
            await expect(page.getByText(MSJ.largo)).toBeVisible();
            await sigueEnRegistro(page);
        });
    });

    test('caso 010: contraseña de 8 caracteres se acepta y registra @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await llenarRegistro(page, { nombre: 'Ocho', apellido: 'Letras', clave: 'Abcde1!x' });
        await registrarse(page);
        await caso(10, 'crea la cuenta con una contraseña de exactamente 8 caracteres y entra a Buscar un objeto', async () => {
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
            await expect(page.getByText('¡Bienvenido, Ocho!')).toBeVisible();
        });
    });

    test('caso 011: email ya registrado no crea la cuenta y lo avisa @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await llenarRegistro(page, { email: USUARIOS_PARALELO.usuarioValeria });
        await registrarse(page);
        await caso(11, 'avisa que el email ya está registrado y no entra', async () => {
            await expect(page.getByText(/ya (est[aá] )?(registrad|existe|en uso)|registrad/i).first()).toBeVisible();
            await sigueEnRegistro(page);
        });
    });

    test('caso 012: email de formato inválido no registra @sesion @paralelo', async ({ page }) => {
        await caso(12, 'un email sin arroba y otro sin dominio muestran "Ingresá un email válido."', async () => {
            for (const invalido of ['correo.sin.arroba.com', 'usuario@sindominio']) {
                await irARegistro(page);
                await llenarRegistro(page, { email: invalido });
                await registrate(page).click();
                await expect.soft(page.getByText(MSJ.emailInvalido), `"${invalido}" debería rechazarse`).toBeVisible();
                await sigueEnRegistro(page);
            }
        });
    });

    test('caso 013: contraseña de más de 16 caracteres o sin símbolo no registra @sesion @paralelo', async ({ page }) => {
        await caso(13, 'una contraseña de 17 caracteres y otra de 8 sin símbolo se rechazan con su mensaje', async () => {
            await irARegistro(page);
            await llenarRegistro(page, { clave: 'Abcdefgh1!abcdefg' });
            await registrate(page).click();
            await expect.soft(page.getByText(MSJ.largo), 'de 17 caracteres').toBeVisible();
            await sigueEnRegistro(page);

            await irARegistro(page);
            await llenarRegistro(page, { clave: 'Abcdefg1' });
            await registrate(page).click();
            await expect.soft(page.getByText(MSJ.simbolo), 'de 8 sin símbolo').toBeVisible();
            await sigueEnRegistro(page);
        });
    });

    test('casos 331 y 333: recuperación de contraseña desde el login @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await caso(331, 'el login muestra "¿Olvidaste tu contraseña?"', async () => {
            await expect(page.getByText('¿Olvidaste tu contraseña?')).toBeVisible();
        });
        await caso(333, 'un email no registrado muestra "No se encontró el usuario con el username <email>" y no avanza', async () => {
            const noExiste = emailNuevo('no.existe');
            await page.getByText('¿Olvidaste tu contraseña?').click();
            await expect(page.getByText('Recuperar contraseña', { exact: true })).toBeVisible();
            await ph(page, 'Email').fill(noExiste);
            await page.getByText('Enviar código').click();
            await expect(page.getByText(`No se encontró el usuario con el username ${noExiste}`)).toBeVisible();
            await expect(page.getByText('Recuperar contraseña', { exact: true })).toBeVisible();
            await expect(page.getByText('Nueva contraseña', { exact: true })).toHaveCount(0);
        });
    });
});
