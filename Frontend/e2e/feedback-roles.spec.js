// Disponibilidad del botón de opinión sobre la app según el rol (caso 265).
// Va en @serie porque usa al encargado de la organización 1, que es del carril serie (solo se lee, no cambia nada).
const { test, expect } = require('@playwright/test');
const { USUARIOS, USUARIOS_PARALELO } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const t05 = require('./helpers/t05');

test('caso 265: el botón de opinión sobre la app está en Mi perfil de usuario, empleado, encargado y dueño @feedback @serie', async ({ browser }) => {
    const roles = [
        ['usuario final', USUARIOS_PARALELO.usuarioValeria],
        ['empleado', USUARIOS_PARALELO.empleadoAero],
        ['encargado', USUARIOS.encargado],
        ['dueño de organización', USUARIOS_PARALELO.duenoUnc],
    ];
    await test.step('caso 265: el botón se ve y se puede presionar en Mi perfil con los cuatro roles', async () => {
        for (const [rol, email] of roles) {
            const { context, page } = await abrirComo(browser, email);
            try {
                await t05.abrirModalFeedback(page);
                await expect(page.getByText('¿Cómo fue tu experiencia?'), `el ${rol} abre el modal`).toBeVisible();
            } finally {
                await context.close();
            }
        }
    });
});
