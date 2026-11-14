// Disponibilidad del botón de opinión sobre la app según el rol (caso 293).
const { test, expect } = require('@playwright/test');
const { USUARIOS_PARALELO } = require('./helpers');
const { abrirComo } = require('./helpers/t02');
const t05 = require('./helpers/t05');

test('caso 293: el botón de opinión sobre la app está en Mi perfil de usuario, empleado y dueño @feedback @paralelo', async ({ browser }) => {
    const roles = [
        ['usuario común', USUARIOS_PARALELO.usuarioValeria],
        ['empleado', USUARIOS_PARALELO.empleadoAero],
        ['dueño de organización', USUARIOS_PARALELO.duenoUnc],
    ];
    await test.step('caso 293: el botón se ve y abre el modal para cada rol', async () => {
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
