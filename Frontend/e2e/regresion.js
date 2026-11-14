// Corre la regresión E2E completa en dos carriles a la vez (serie y paralelo) y deja un informe unificado.
// Uso: npm run test:e2e:regresion [-- --grep <patrón>]
// Variables: E2E_WORKERS_PARALELO (por defecto 3), E2E_BASE_URL.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const p2 = (n) => String(n).padStart(2, '0');
const inicio = new Date();
const sello = `${inicio.getFullYear()}-${p2(inicio.getMonth() + 1)}-${p2(inicio.getDate())}_${p2(inicio.getHours())}-${p2(inicio.getMinutes())}`;
const carpeta = path.join(raiz, 'e2e-resultados', sello);
fs.mkdirSync(carpeta, { recursive: true });

// Sesiones y conteo de 429 desde cero: el globalSetup de cada carril las arma de nuevo (ver e2e/helpers/sesion.js).
const carpetaSesiones = path.join(__dirname, '.sesiones');
fs.rmSync(carpetaSesiones, { recursive: true, force: true });

const i = process.argv.indexOf('--grep');
const extra = i >= 0 ? process.argv[i + 1] : null;
const workersParalelo = process.env.E2E_WORKERS_PARALELO || '3';

const win = process.platform === 'win32';
// En Windows hace falta shell para npx; los argumentos con espacios o paréntesis van entre comillas.
const q = (s) => (win ? `"${s}"` : s);

const correr = (args, entorno) =>
    new Promise((resolve) => {
        const proc = spawn(win ? 'npx.cmd' : 'npx', args, { cwd: raiz, env: { ...process.env, ...entorno }, shell: win, stdio: ['ignore', 'pipe', 'pipe'] });
        let salida = '';
        proc.stdout.on('data', (d) => (salida += d));
        proc.stderr.on('data', (d) => (salida += d));
        proc.on('close', (codigo) => resolve({ codigo, salida }));
    });

// El patrón del carril y el adicional se combinan (los dos tienen que estar en el título).
const patron = (etiqueta) => (extra ? `(?=.*${etiqueta})(?=.*(?:${extra}))` : etiqueta);

async function carril(nombre, workers) {
    const t0 = Date.now();
    const blobs = path.join(carpeta, 'blobs', nombre);
    const r = await correr(
        ['playwright', 'test', '--grep', q(patron('@' + nombre)), `--workers=${workers}`, '--reporter=blob', '--output', q(path.join(carpeta, 'test-results', nombre))],
        { E2E_CAPTURAS: 'on', PLAYWRIGHT_BLOB_OUTPUT_DIR: blobs }
    );
    fs.writeFileSync(path.join(carpeta, `${nombre}.log`), r.salida);
    return { nombre, codigo: r.codigo, ms: Date.now() - t0, blobs };
}

const dur = (ms) => `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;

(async () => {
    console.log(`Regresión E2E iniciada ${inicio.toLocaleString('es-AR', { hour12: false })}. Carpeta: ${carpeta}`);
    const carriles = await Promise.all([carril('serie', 1), carril('paralelo', workersParalelo)]);
    const fin = new Date();

    // Unir los blobs de los dos carriles.
    const blobsJuntos = path.join(carpeta, 'blobs-todos');
    fs.mkdirSync(blobsJuntos, { recursive: true });
    for (const c of carriles) {
        if (!fs.existsSync(c.blobs)) continue;
        for (const f of fs.readdirSync(c.blobs)) fs.copyFileSync(path.join(c.blobs, f), path.join(blobsJuntos, `${c.nombre}-${f}`));
    }
    const jsonRuta = path.join(carpeta, 'resultados.json');
    const mJson = await correr(['playwright', 'merge-reports', '--reporter', 'json', q(blobsJuntos)], { PLAYWRIGHT_JSON_OUTPUT_FILE: jsonRuta });
    const mHtml = await correr(['playwright', 'merge-reports', '--reporter', 'html', q(blobsJuntos)], { PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(carpeta, 'informe'), PLAYWRIGHT_HTML_OPEN: 'never' });
    if (mJson.codigo !== 0) console.error('No se pudo unir el json:\n' + mJson.salida);
    if (mHtml.codigo !== 0) console.error('No se pudo unir el html:\n' + mHtml.salida);

    let stats = { expected: 0, unexpected: 0, skipped: 0, flaky: 0 };
    try {
        stats = { ...stats, ...JSON.parse(fs.readFileSync(jsonRuta, 'utf8')).stats };
    } catch (e) {
        console.error('No se pudo leer resultados.json');
    }

    let cantidad429 = 0;
    try {
        cantidad429 = fs.readFileSync(path.join(carpetaSesiones, '429.txt'), 'utf8').split(String.fromCharCode(10)).filter(Boolean).length;
        fs.copyFileSync(path.join(carpetaSesiones, '429.txt'), path.join(carpeta, 'respuestas-429.txt'));
    } catch (e) { /* no hubo 429 */ }

    const resumen = [
        `Inicio: ${inicio.toLocaleString('es-AR', { hour12: false })}`,
        `Fin: ${fin.toLocaleString('es-AR', { hour12: false })}`,
        `Duración total: ${dur(fin - inicio)}`,
        ...carriles.map((c) => `Duración del carril ${c.nombre}: ${dur(c.ms)}`),
        `Pasados: ${stats.expected}`,
        `Fallados: ${stats.unexpected}`,
        `Salteados: ${stats.skipped}`,
        `Respuestas 429 de ingreso o registro: ${cantidad429}`,
        ...(stats.flaky ? [`Inestables: ${stats.flaky}`] : []),
        '',
    ].join('\n');
    fs.writeFileSync(path.join(carpeta, 'resumen.txt'), resumen);
    console.log(`\nCarpeta: ${carpeta}\n\n${resumen}`);
    process.exit(stats.unexpected > 0 ? 1 : 0);
})();
