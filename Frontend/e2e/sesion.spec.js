const { test, expect } = require('@playwright/test');
const { USUARIOS, irAlLogin, completarYEnviarLogin, iniciarSesion, abrirMenu } = require('./helpers');

test.describe('Sesión', () => {
    test('caso 001/018: con credenciales correctas entra a Buscar un objeto', async ({ page }) => {
        await irAlLogin(page);
        await completarYEnviarLogin(page, USUARIOS.usuario, 'Eurekapp1!');

        await expect(page.getByText('¡Bienvenido, Julia!')).toBeVisible();
        await expect(page.getByText('Descripción del objeto:')).toBeVisible();
    });

    test('caso 002: con credenciales incorrectas no deja entrar y avisa', async ({ page }) => {
        await irAlLogin(page);
        await completarYEnviarLogin(page, USUARIOS.usuario, 'ClaveEquivocada9!');

        await expect(page.getByText('Error en los datos enviados')).toBeVisible();
        await expect(page.getByText('Logout')).toHaveCount(0);
    });

    test('caso 003: con los campos vacíos pide completarlos', async ({ page }) => {
        await irAlLogin(page);
        await page.getByText('Iniciar sesión', { exact: true }).last().click();

        await expect(page.getByText('Email requerido')).toBeVisible();
        await expect(page.getByText('Contraseña requerida')).toBeVisible();
        await expect(page.getByText('Logout')).toHaveCount(0);
    });

    test('caso 024: cierra la sesión desde el menú y vuelve a la portada', async ({ page }) => {
        await iniciarSesion(page, USUARIOS.usuario);
        await abrirMenu(page);
        await page.getByText('Logout').click();

        await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
        // La sesión quedó cerrada de verdad: recargar no devuelve al usuario adentro.
        await page.reload();
        await expect(page.getByText('Bienvenido a Eurekapp')).toBeVisible();
        await expect(page.getByText('Logout')).toHaveCount(0);
    });
});
