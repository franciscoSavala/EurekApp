const { test, expect } = require('@playwright/test');
const { caso, irAlLogin, USUARIOS_PARALELO } = require('./helpers');
const { emailUnico, irARegistro, completarRegistro, registrate, ph } = require('./helpers/t01');

test.describe('Registro y acceso', () => {
    test('casos 004 y 014: de login a registro y de registro a login @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await caso(4, 'el enlace "¿No tenés cuenta? Registrate" lleva al registro', async () => {
            await page.getByText('¿No tenés cuenta? Registrate').click();
            await expect(ph(page, 'Nombre')).toBeVisible();
            await expect(ph(page, 'Apellido')).toBeVisible();
            await expect(registrate(page)).toBeVisible();
        });
        await caso(14, 'el enlace "Ya tengo cuenta. Iniciar sesión" lleva al login', async () => {
            await page.getByText('Ya tengo cuenta. Iniciar sesión').click();
            await expect(ph(page, 'Contraseña')).toBeVisible();
            await expect(ph(page, 'Nombre')).toHaveCount(0);
            await expect(page.getByText('Iniciar sesión', { exact: true }).last()).toBeVisible();
        });
    });

    test('caso 005: registro exitoso con datos válidos @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await completarRegistro(page, { nombre: 'Alta', apellido: 'Prueba' });
        await registrate(page).click();
        await caso(5, 'registra al usuario y lo lleva a Buscar un objeto', async () => {
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
            await expect(page.getByText('¡Bienvenido, Alta!')).toBeVisible();
        });
    });

    test('caso 006: los campos se validan en orden y se muestra solo el error del primero inválido @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        const errores = async () => ({
            nombre: await page.getByText('El nombre es obligatorio.').count(),
            apellido: await page.getByText('El apellido es obligatorio.').count(),
            email: await page.getByText(/La dirección de email es obligatoria\.|Ingresá un email válido\./).count(),
            clave: await page.getByText(/^La contraseña (es obligatoria|debe)/).count(),
        });
        await caso(6, 'validación secuencial Nombre, Apellido, Email, Contraseña con un solo error por vez', async () => {
            await registrate(page).click();
            await page.waitForTimeout(500);
            expect.soft(await errores(), 'todo vacío: solo debe verse el error del nombre').toEqual({ nombre: 1, apellido: 0, email: 0, clave: 0 });

            await ph(page, 'Nombre').fill('Ana');
            await registrate(page).click();
            await page.waitForTimeout(500);
            expect.soft(await errores(), 'solo nombre: debe verse solo el error del apellido').toEqual({ nombre: 0, apellido: 1, email: 0, clave: 0 });

            await ph(page, 'Apellido').fill('Gómez');
            await registrate(page).click();
            await page.waitForTimeout(500);
            expect.soft(await errores(), 'nombre y apellido: debe verse solo el error del email').toEqual({ nombre: 0, apellido: 0, email: 1, clave: 0 });

            await ph(page, 'Email').fill('correo-invalido');
            await registrate(page).click();
            await page.waitForTimeout(500);
            expect.soft(await errores(), 'email inválido: debe verse solo el error del email').toEqual({ nombre: 0, apellido: 0, email: 1, clave: 0 });

            await ph(page, 'Email').fill(emailUnico());
            await ph(page, 'Contraseña').fill('abc12');
            await registrate(page).click();
            await page.waitForTimeout(500);
            expect.soft(await errores(), 'contraseña corta: debe verse solo el error de la contraseña').toEqual({ nombre: 0, apellido: 0, email: 0, clave: 1 });
        });
    });

    test('casos 007, 008, 009, 010 y 017: campo obligatorio vacío no registra y mantiene la pantalla @sesion @paralelo', async ({ page }) => {
        // Cada caso parte de un formulario nuevo: el formulario conserva lo ya cargado aunque los campos se vean vacíos.
        const sigueEnRegistro = async () => {
            await expect(ph(page, 'Nombre')).toBeVisible();
            await expect(page.getByText('Descripción del objeto:')).toHaveCount(0);
        };
        await caso(7, 'sin nombre: avisa que el nombre es obligatorio', async () => {
            await irARegistro(page);
            await completarRegistro(page, { nombre: null });
            await registrate(page).click();
            await expect(page.getByText(/nombre.*obligatori/i)).toBeVisible();
            await sigueEnRegistro();
        });
        await caso(8, 'sin apellido: avisa que el apellido es obligatorio', async () => {
            await irARegistro(page);
            await completarRegistro(page, { apellido: null });
            await registrate(page).click();
            await expect(page.getByText(/apellido.*obligatori/i)).toBeVisible();
            await sigueEnRegistro();
        });
        await caso(9, 'sin email: avisa que el email es obligatorio o inválido', async () => {
            await irARegistro(page);
            await completarRegistro(page, { email: null });
            await registrate(page).click();
            await expect(page.getByText(/email.*(obligatori|válid)/i)).toBeVisible();
            await sigueEnRegistro();
        });
        await caso(10, 'sin contraseña: avisa que la contraseña es obligatoria', async () => {
            await irARegistro(page);
            await completarRegistro(page, { clave: null });
            await registrate(page).click();
            await expect(page.getByText(/contraseña.*obligatori/i)).toBeVisible();
            await sigueEnRegistro();
        });
        await caso(17, 'con un dato inválido muestra el error y no redirige', async () => {
            await irARegistro(page);
            await completarRegistro(page, { email: 'no-es-un-email' });
            await registrate(page).click();
            await expect(page.getByText('Ingresá un email válido.')).toBeVisible();
            await sigueEnRegistro();
        });
    });

    test('caso 011: contraseña de menos de 6 caracteres muestra el mensaje de largo mínimo @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await completarRegistro(page, { clave: 'Ab1!x' });
        await registrate(page).click();
        await caso(11, 'avisa "La contraseña debe tener al menos 6 caracteres."', async () => {
            await expect(page.getByText('La contraseña debe tener al menos 6 caracteres.')).toBeVisible();
            await expect(page.getByText('Descripción del objeto:')).toHaveCount(0);
        });
    });

    test('caso 012: contraseña de exactamente 6 caracteres se acepta y registra @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await completarRegistro(page, { nombre: 'Seis', apellido: 'Letras', clave: 'Ab1!xy' });
        await registrate(page).click();
        await caso(12, 'registra al usuario con una contraseña de 6 caracteres', async () => {
            await expect(page.getByText('Descripción del objeto:')).toBeVisible();
        });
    });

    test('caso 013: email ya registrado no crea la cuenta y lo avisa @sesion @paralelo', async ({ page }) => {
        await irARegistro(page);
        await completarRegistro(page, { email: USUARIOS_PARALELO.usuarioValeria });
        await registrate(page).click();
        await caso(13, 'avisa que el email ya está registrado y no entra', async () => {
            await expect(page.getByText(/ya (est[aá] )?(registrad|existe|en uso)|registrad/i).first()).toBeVisible();
            await expect(page.getByText('Descripción del objeto:')).toHaveCount(0);
        });
    });

    test('casos 461, 462 y 464: recuperación de contraseña desde el login @sesion @paralelo', async ({ page }) => {
        await irAlLogin(page);
        await caso(461, 'el login muestra "¿Olvidaste tu contraseña?"', async () => {
            await expect(page.getByText('¿Olvidaste tu contraseña?')).toBeVisible();
        });
        await caso(462, 'el enlace lleva al formulario de recuperación', async () => {
            await page.getByText('¿Olvidaste tu contraseña?').click();
            await expect(page.getByText('Recuperar contraseña', { exact: true })).toBeVisible();
            await expect(page.getByText('Enviar código')).toBeVisible();
        });
        await caso(464, 'un email no registrado muestra un error que dice que no existe', async () => {
            await ph(page, 'Email').fill(emailUnico('no.existe'));
            await page.getByText('Enviar código').click();
            await expect(page.getByText(/no (se )?(encontr|existe|est[aá] registrad)/i)).toBeVisible();
            // No pasó a la pantalla de ingreso del código.
            await expect(page.getByText('Recuperar contraseña', { exact: true })).toBeVisible();
        });
    });
});
