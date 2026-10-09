#!/usr/bin/env node
// Smoke HTTP do contrato usado pelo front contra um backend-nest em execucao.
// Rode contra um banco DESCARTAVEL migrado pelo Django com o seed: cada execucao cria usuarios e roteiros.
// Uso: BASE_URL=http://localhost:8001 npm run smoke
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8001').replace(/\/+$/, '');
const RUN = Date.now();
const PASSWORD = 'senha-smoke-123';
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const SENSITIVE = /password|email|pbkdf2/;

let failures = 0;

function check(condition, label, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  const shown = detail === undefined ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`  FAIL ${label}${shown.slice(0, 500)}`);
}

async function call(method, route, { token, json, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (form) body = form;
  const response = await fetch(`${BASE_URL}${route}`, { method, headers, body });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, payload, text };
}

async function register(label) {
  const email = `smoke-${label}-${RUN}@viajero.dev`;
  const res = await call('POST', '/api/auth/register/', {
    json: { email, password: PASSWORD, display_name: `Smoke ${label}`, first_name: 'Smoke', last_name: label },
  });
  check(res.status === 201, `cadastro (${label}) -> 201`, res.payload);
  return { email, token: res.payload?.data?.access, user: res.payload?.data?.user };
}

function imageForm(bytes, type, filename) {
  const form = new FormData();
  form.append('avatar', new Blob([bytes], { type }), filename);
  return form;
}

async function main() {
  console.log(`Smoke do contrato front <-> backend-nest em ${BASE_URL}`);

  console.log('\n# Autenticacao');
  const owner = await register('dono');
  const token = owner.token;
  check(typeof owner.user?.id === 'number', 'id do usuario e number', owner.user);
  const duplicate = await call('POST', '/api/auth/register/', { json: { email: owner.email, password: PASSWORD } });
  check(duplicate.status === 400 && duplicate.payload?.message === 'Ja existe um usuario cadastrado com este email.', 'email duplicado -> 400 PT', duplicate.payload);
  const login = await call('POST', '/api/auth/login/', { json: { email: owner.email, password: PASSWORD } });
  check(login.status === 200 && typeof login.payload?.data?.access === 'string', 'login -> 200 com token', login.payload);
  const badLogin = await call('POST', '/api/auth/login/', { json: { email: owner.email, password: 'senha-errada' } });
  check(badLogin.status === 400 && badLogin.payload?.message === 'Email ou senha invalidos.', 'senha errada -> 400 PT', badLogin.payload);
  const expired = await call('GET', '/api/users/me/', { token: 'token-invalido' });
  check(expired.status === 401 && expired.payload?.message === 'Sessao expirada ou nao autenticada. Entre novamente.', 'token invalido -> 401 PT', expired.payload);
  const missing = await call('GET', '/api/rota-inexistente/');
  check(missing.status === 404 && missing.payload?.message === 'Recurso nao encontrado.', 'rota inexistente -> 404 PT', missing.payload);

  console.log('\n# Perfil (onboarding)');
  const dnaBefore = await call('GET', '/api/traveler-dna/me/', { token });
  check(dnaBefore.status === 200 && dnaBefore.payload?.data === null, 'DNA inicial vazio', dnaBefore.payload);
  const dna = await call('PATCH', '/api/traveler-dna/me/', {
    token,
    json: { travel_style: 'balanced', pace: 'moderate', comfort_level: 'mid', social_energy: 5, adventure_level: 6, food_focus: 7, cultural_interest: 9, nature_interest: 4, nightlife_interest: 3, notes: '{"text":"smoke"}' },
  });
  check(dna.status === 200 && Number(dna.payload?.data?.id) > 0, 'PATCH DNA cria o perfil', dna.payload);
  const hijack = await call('PATCH', '/api/traveler-dna/me/', { token, json: { id: 999999, pace: 'fast' } });
  check(hijack.status === 200 && String(hijack.payload?.data?.id) === String(dna.payload?.data?.id) && hijack.payload?.data?.pace === 'fast', 'PATCH DNA ignora id enviado', hijack.payload);
  const prefs = await call('PATCH', '/api/trip-preferences/me/', {
    token,
    json: { budget_min: 2000, budget_max: 6000, currency_code: 'BRL', companionship: 'couple', preferred_trip_length_days: 4, travel_month: 'novembro', hotel_level: 'standard', transportation_style: 'public', dietary_preferences: [], accessibility_needs: [], interests: ['culture', 'food'], metadata: { flexible_dates: true } },
  });
  check(prefs.status === 200 && Number(prefs.payload?.data?.id) > 0, 'PATCH preferencias', prefs.payload);
  const me = await call('GET', '/api/users/me/', { token });
  check(me.payload?.data?.is_profile_complete === true, 'is_profile_complete vira true', me.payload);
  const patchMe = await call('PATCH', '/api/users/me/', { token, json: { display_name: 'Smoke Dono Editado' } });
  check(patchMe.status === 200 && patchMe.payload?.data?.display_name === 'Smoke Dono Editado', 'PATCH usuario', patchMe.payload);

  console.log('\n# Avatar');
  const avatar = await call('POST', '/api/users/me/avatar/', { token, form: imageForm(PNG_1X1, 'image/png', 'avatar.png') });
  const avatarUrl = avatar.payload?.data?.avatar_url;
  check(avatar.status === 200 && typeof avatarUrl === 'string' && avatarUrl.includes('/uploads/avatars/'), 'upload de avatar', avatar.payload);
  if (typeof avatarUrl === 'string') {
    const image = await fetch(avatarUrl);
    check(
      image.status === 200 && image.headers.get('content-type')?.startsWith('image/png') && image.headers.get('x-content-type-options') === 'nosniff',
      'avatar servido em /uploads com nosniff',
      `${image.status} ${image.headers.get('content-type')}`,
    );
  }
  const badAvatar = await call('POST', '/api/users/me/avatar/', { token, form: imageForm(Buffer.from('nao sou imagem'), 'text/plain', 'nota.txt') });
  check(badAvatar.status === 400 && badAvatar.payload?.message === 'Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.', 'avatar com tipo invalido -> 400 PT', badAvatar.payload);

  console.log('\n# Destinos');
  const destinations = await call('GET', '/api/destinations/');
  const list = destinations.payload?.data ?? [];
  check(destinations.status === 200 && list.length > 0 && Number(list[0].id) > 0, 'lista de destinos', destinations.payload?.message);
  const target = list.find((item) => (item.pois ?? []).length > 0) ?? list[0];
  const search = await call('GET', `/api/destinations/search/?q=${encodeURIComponent(target.name)}`);
  check(search.status === 200 && (search.payload?.data ?? []).some((item) => item.id === target.id), 'busca encontra o destino', search.payload?.message);
  const suggest = await call('POST', '/api/destinations/suggest/', { token });
  check(suggest.status === 200 && Number(suggest.payload?.data?.id) > 0 && suggest.payload?.message?.startsWith('Destino sugerido'), 'sugestao de destino', suggest.payload?.message);

  console.log('\n# Roteiro (fluxo do front)');
  const created = await call('POST', '/api/itineraries/', { token, json: { destination: target.id, title: target.name } });
  const itinerary = created.payload?.data;
  const itineraryId = itinerary?.id;
  check(created.status === 201 && itinerary?.duration_days === 4 && itinerary?.budget_total === '4000.00', 'criacao com payload do front usa preferencias', created.payload);
  const dates = await call('PATCH', `/api/itineraries/${itineraryId}/`, { token, json: { start_date: '2026-11-10', end_date: '2026-11-13' } });
  check(dates.status === 200 && dates.payload?.data?.start_date === '2026-11-10' && dates.payload?.data?.end_date === '2026-11-13', 'PATCH de datas', dates.payload?.data);
  const badDates = await call('PATCH', `/api/itineraries/${itineraryId}/`, { token, json: { end_date: '2026-11-01' } });
  check(badDates.status === 400 && badDates.payload?.message === 'A data final nao pode ser anterior a data inicial.', 'data final anterior -> 400 PT', badDates.payload);
  const generated = await call('POST', `/api/itineraries/${itineraryId}/generate/`, { token });
  check(generated.status === 202 && generated.payload?.data?.generation_status === 'ready' && (generated.payload?.data?.days ?? []).length === 4, 'geracao -> 202 pronto com 4 dias', generated.payload?.message);
  const regenerated = await call('POST', `/api/itineraries/${itineraryId}/generate/`, { token });
  check(regenerated.status === 202 && (regenerated.payload?.data?.days ?? []).length === 4, 'regeracao funciona', regenerated.payload?.message);
  const detail = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(detail.status === 200 && detail.payload?.data?.is_owner === true, 'detalhe do dono com is_owner', detail.payload?.message);
  const mine = await call('GET', '/api/itineraries/', { token });
  check((mine.payload?.data ?? []).some((item) => item.id === itineraryId), 'roteiro na lista do dono');

  console.log('\n# Avaliacoes');
  const visitor = await register('visitante');
  const privateDetail = await call('GET', `/api/itineraries/${itineraryId}/`, { token: visitor.token });
  check(privateDetail.status === 404, 'visitante nao ve roteiro privado', privateDetail.payload);
  const rankingBefore = await call('GET', '/api/itineraries/top-rated/');
  check(!(rankingBefore.payload?.data ?? []).some((item) => item.id === itineraryId), 'roteiro privado fora do top-rated');
  const earlyReview = await call('POST', '/api/reviews/', { token: visitor.token, json: { itinerary: itineraryId, rating: 4 } });
  check(earlyReview.status === 404, 'visitante nao avalia roteiro privado', earlyReview.payload);
  const ownerReview = await call('POST', '/api/reviews/', { token, json: { itinerary: itineraryId, rating: 5, title: 'Perfeito', body: 'Roteiro equilibrado.' } });
  check(ownerReview.status === 201 && ownerReview.payload?.data?.user?.display_name === 'Smoke Dono Editado', 'dono avalia o proprio roteiro', ownerReview.payload);
  check(!SENSITIVE.test(ownerReview.text), 'resposta da avaliacao sem dados sensiveis', ownerReview.text);
  const again = await call('POST', '/api/reviews/', { token, json: { itinerary: itineraryId, rating: 4 } });
  check(again.status === 409 && again.payload?.message === 'Voce ja avaliou este roteiro.', 'avaliacao duplicada -> 409 PT', again.payload);
  const ranking = await call('GET', '/api/itineraries/top-rated/');
  const ranked = (ranking.payload?.data ?? []).find((item) => item.id === itineraryId);
  check(ranked?.review_stats?.review_count === 1, 'roteiro avaliado entra no top-rated', ranking.payload?.message);
  const publicDetail = await call('GET', `/api/itineraries/${itineraryId}/`, { token: visitor.token });
  check(publicDetail.status === 200 && publicDetail.payload?.data?.is_owner === false, 'visitante ve roteiro publico', publicDetail.payload?.message);
  const visitorReview = await call('POST', '/api/reviews/', { token: visitor.token, json: { itinerary: itineraryId, rating: 3 } });
  check(visitorReview.status === 201, 'visitante avalia roteiro publico', visitorReview.payload);
  const afterTwo = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(afterTwo.payload?.data?.review_stats?.review_count === 2 && afterTwo.payload?.data?.review_stats?.average_rating === '4.00', 'media com 2 avaliacoes (4.00)', afterTwo.payload?.data?.review_stats);
  const visitorReviewId = visitorReview.payload?.data?.id;
  const edited = await call('PATCH', `/api/reviews/${visitorReviewId}/`, { token: visitor.token, json: { rating: 4, body: 'Mudei de ideia.' } });
  check(edited.status === 200 && edited.payload?.data?.rating === 4, 'visitante edita a propria avaliacao', edited.payload);
  const afterEdit = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(afterEdit.payload?.data?.review_stats?.average_rating === '4.50', 'media apos edicao (4.50)', afterEdit.payload?.data?.review_stats);
  const foreignEdit = await call('PATCH', `/api/reviews/${ownerReview.payload?.data?.id}/`, { token: visitor.token, json: { rating: 1 } });
  check(foreignEdit.status === 404, 'visitante nao edita avaliacao do dono', foreignEdit.payload);
  const removed = await call('DELETE', `/api/reviews/${visitorReviewId}/`, { token: visitor.token });
  check(removed.status === 200, 'visitante exclui a propria avaliacao', removed.payload);
  const publicList = await call('GET', `/api/reviews/?itinerary=${itineraryId}`);
  check(publicList.status === 200 && (publicList.payload?.data ?? []).length === 1, 'lista publica com 1 avaliacao', publicList.payload);
  check(!SENSITIVE.test(publicList.text), 'lista publica sem dados sensiveis', publicList.text);
  const afterDelete = await call('GET', `/api/itineraries/${itineraryId}/`, { token });
  check(afterDelete.payload?.data?.review_stats?.review_count === 1 && afterDelete.payload?.data?.review_stats?.average_rating === '5.00', 'stats apos exclusao (1, 5.00)', afterDelete.payload?.data?.review_stats);

  console.log(failures === 0 ? '\nSmoke OK' : `\nSmoke falhou: ${failures} verificacao(oes)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
