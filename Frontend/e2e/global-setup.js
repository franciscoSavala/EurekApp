// Antes de los tests: inicia sesión por la API, una vez, con cada usuario del seed que usan los tests y
// guarda token y estado del navegador en e2e/.sesiones/. Los pedidos se espacian a lo sumo 8 por minuto.
// Los dos carriles de la regresión corren este archivo a la vez: el cerrojo hace que no repitan ingresos.
const { USUARIOS, USUARIOS_PARALELO } = require('./helpers');
const { sesionDe, sesionVigente, cantidad429, conCerrojo } = require('./helpers/sesion');

// Los tres bloqueados por fraude en el seed (micaela, emp1.patio, emp1.dino) no pueden ingresar: no se piden.
const BLOQUEADOS = new Set([USUARIOS_PARALELO.usuarioMicaela, USUARIOS_PARALELO.empleadoPatio, USUARIOS_PARALELO.empleadoDino]);
const EXTRAS = ['emp2.utn@eurekapp.com', 'owner.term@eurekapp.com'];

module.exports = async function globalSetup() {
    const emails = [...new Set([...Object.values(USUARIOS), ...Object.values(USUARIOS_PARALELO), ...EXTRAS])].filter((e) => !BLOQUEADOS.has(e));
    const antes = cantidad429();
    const t0 = Date.now();
    // Un solo carril a la vez arma las sesiones; el otro espera y encuentra todo vigente.
    await conCerrojo('globalsetup', async () => {
        for (const email of emails) {
            if (sesionVigente(email)) continue;
            try {
                await sesionDe(email, { renovar: true });
            } catch (e) {
                // Si un usuario no puede ingresar, los tests que lo necesiten fallarán con su propio error.
                console.warn(`globalSetup: no se pudo iniciar sesión con ${email}: ${e.message}`);
            }
        }
    }, 15 * 60 * 1000);
    console.log(`globalSetup: ${emails.length} sesiones listas en ${Math.round((Date.now() - t0) / 1000)} s, ${cantidad429() - antes} respuestas 429`);
};
