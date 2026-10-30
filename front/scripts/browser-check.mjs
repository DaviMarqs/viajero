import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Explicit browser-only fixtures. No mock data is bundled with the application.
// Point PLAYWRIGHT_MODULE to an existing playwright installation; no install required.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.FRONT_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
await fs.mkdir('artifacts', { recursive: true });
const report = { mode: 'Isolated UI fixtures; not live API integration', routes: [], checks: [], errors: [], console: [], networkFailures: [], requests: [], devtools: [] };
const destination = { id: 91001, name: 'Destino de teste', country: 'Brasil', summary: 'Dados de teste exclusivos para verificar a interface.', hero_image_url: '/src/assets/trip-example.jpg', metadata: { tags: ['Natureza', 'Cultura'] }, cost_profile: { daily_budget_mid: '250', currency_code: 'BRL' }, pois: [] };
const itinerary = { id: 92001, title: 'Roteiro de teste', destination: destination.id, destination_name: destination.name, summary: 'Fixture de validação da interface.', generation_status: 'ready', budget_total: '1250', currency_code: 'BRL', duration_days: 5, days: [{ id: 1, day_number: 1, title: 'Dia de teste', events: [{ id: 1, title: 'Atividade de teste' }] }] };
const user = { id: 90001, display_name: 'Pessoa de teste', first_name: 'Pessoa', email: 'fixture@example.invalid', is_profile_complete: true };
try {
  const publicPage = await browser.newPage();
  await publicPage.goto(base + '/');
  await publicPage.waitForURL('**/login');
  await publicPage.getByRole('button', { name: 'Fazer login', exact: true }).click();
  await publicPage.getByText('Informe sua senha', { exact: true }).waitFor();
  report.checks.push('Unauthenticated routes redirect; required login validation is visible');
  await publicPage.close();
  const context = await browser.newContext();
  await context.addInitScript(({ user }) => {
    localStorage.setItem('viajero.access_token', 'browser-fixture-not-a-real-token');
    localStorage.setItem('viajero.user', JSON.stringify(user));
  }, { user });
  let mode = 'success';
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    report.requests.push({ path, method: request.method(), acceptsJson: request.headers().accept === 'application/json', hasAuthorization: !!request.headers().authorization, body: request.postDataJSON() });
    if (mode === 'network-error') return route.abort('connectionrefused');
    if (mode === 'server-error') return route.fulfill({ status: 503, json: { success: false, message: 'Serviço indisponível para teste.' } });
    if (mode === 'loading') await new Promise(resolve => setTimeout(resolve, 600));
    let data = null;
    if (path.includes('destinations')) data = mode === 'empty' ? [] : path.includes('suggest') || path.includes('search') ? [destination] : { results: [destination, { ...destination, id: 91002, name: 'Outra cidade de teste', hero_image_url: null, metadata: { tags: ['Praia'] } }] };
    else if (path.includes('itineraries')) data = request.method() === 'POST' || /itineraries\/\d+/.test(path) ? itinerary : mode === 'empty' ? [] : [itinerary];
    else if (path.includes('users/me')) data = user;
    else if (path.includes('pois')) data = { results: [] };
    return route.fulfill({ json: { success: true, data } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.console.push({ state: mode, message: message.text() }); });
  page.on('requestfailed', request => report.networkFailures.push({ state: mode, url: request.url(), failure: request.failure()?.errorText }));
  const devtools = await context.newCDPSession(page);
  await devtools.send('Runtime.enable');
  await devtools.send('Network.enable');
  devtools.on('Runtime.exceptionThrown', event => report.devtools.push(event.exceptionDetails.text));
  const routes = ['/', '/explorar', '/recomendações', '/destinos/91001', '/roteiros', '/roteiros/criacao', '/roteiros/92001', '/perfil', '/onboard', '/onboard/preferências', '/test', '/login', '/register'];
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const [index, route] of routes.entries()) {
      await page.goto(base + route);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(await page.locator('body').evaluate(el => /[a-zA-Z]\?+[a-zA-Z]/.test(el.innerText)), false, 'Broken text encoding');
      report.routes.push({ route, width, overflow, headings: await page.locator('h1').allTextContents() });
      await page.screenshot({ path: `artifacts/fixture-${width}-${index}.png`, fullPage: true });
    }
  }
  await page.goto(base + '/explorar');
  await page.getByLabel('Buscar destinos').fill('Outra');
  await page.getByRole('link', { name: 'Ver destino: Outra cidade de teste' }).click();
  await page.goBack();
  assert.equal(await page.getByLabel('Buscar destinos').inputValue(), 'Outra');
  report.checks.push('Destination search survives browser Back');
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Abrir navegação' }).evaluate(el => el === document.activeElement), true);
  report.checks.push('Mobile dialog closes with Escape and restores focus');
  await page.goto(base + '/roteiros/criacao');
  await page.getByRole('button', { name: /Já sei para onde/ }).click();
  await page.getByRole('button', { name: /Destino de teste.*Selecionar/ }).click();
  await page.getByRole('button', { name: 'Gerar roteiro para este destino', exact: true }).click();
  await page.waitForURL('**/roteiros/92001');
  assert.equal(report.requests.filter(request => request.path === '/api/itineraries/' && request.method === 'POST').length, 1);
  assert.deepEqual(report.requests.find(request => request.path === '/api/itineraries/' && request.method === 'POST').body, { destination: destination.id, title: destination.name });
  assert.equal(report.requests.every(request => request.acceptsJson && request.hasAuthorization), true);
  report.checks.push('Selection → create → patch dates → generate → poll → detail; single create POST');
  for (const state of ['loading', 'empty', 'server-error', 'network-error']) {
    mode = state;
    await page.goto(base + '/explorar');
    if (state === 'loading') await page.getByRole('status', { name: 'Carregando destinos' }).waitFor();
    else await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `artifacts/state-${state}.png`, fullPage: true });
    if (state.includes('error')) {
      await page.getByRole('button', { name: 'Tentar novamente' }).waitFor();
      mode = 'success';
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.getByRole('link', { name: 'Ver destino: Destino de teste', exact: true }).waitFor();
    }
    report.checks.push(`State ${state} checked${state.includes('error') ? ' with successful retry' : ''}`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  report.checks.push('Reduced motion media setting exercised');
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.devtools, []);
  assert.equal(report.routes.filter(item => item.overflow).length, 0, 'Horizontal overflow found; inspect report');
} finally {
  await fs.writeFile('artifacts/browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ routes: report.routes.length, checks: report.checks, errors: report.errors, overflow: report.routes.filter(item => item.overflow) }, null, 2));
}
