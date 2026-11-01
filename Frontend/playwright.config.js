// Configuración de los tests end-to-end sobre la versión web.
// La app (puerto 8082 por defecto) y el backend (8080) tienen que estar levantados: ver e2e/README.md.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    testMatch: '**/*.spec.js',
    // Varios tests comparten la base y el backend: se corren de a uno.
    workers: 1,
    fullyParallel: false,
    retries: 0,
    timeout: 90_000,
    expect: { timeout: 15_000 },
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    outputDir: 'test-results',
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082',
        acceptDownloads: true,
        viewport: { width: 1280, height: 900 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
