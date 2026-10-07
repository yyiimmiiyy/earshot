'use strict';
/* Earshot window. Talks to the main process only through window.earshot. */

const api = window.earshot;
const $ = (id) => document.getElementById(id);

const state = {
  view: 'reviews',
  settings: null,
  form: { appName: '', store: 'play', tone: 'friendly', contact: '', text: '' },
  fileName: '',
  result: null,   // { overview, themes, reviews, total, dropped, limit, missingReplies }
  busy: ''
};

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

async function call(fn, payload) {
  const res = await fn(payload);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

function notify(message, good) {
  const n = $('notice');
  n.textContent = message || '';
  n.hidden = !message;
  n.className = good ? 'notice good' : 'notice';
}

async function guard(label, fn) {
  if (state.busy) return;
  state.busy = label;
  notify('');
  render();
  try {
    await fn();
  } catch (err) {
    notify(err.message);
  } finally {
    state.busy = '';
    render();
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const KIND = { bug: 'Bug', feature_request: 'Feature request', usability: 'Usability', pricing: 'Pricing', performance: 'Performance', praise: 'Praise', other: 'Other' };

/* ---------- actions ---------- */

const openFile = () => guard('Opening', async () => {
  const r = await call(api.openFile);
  if (r.cancelled) return;
  state.form.text = r.text;
  state.fileName = r.name;
});

const analyse = () => guard('Analysing', async () => {
  state.result = await call(api.analyse, state.form);
  const r = state.result;
  if (r.dropped) notify(`Only the first ${r.reviews.length} of ${r.total} reviews were read. Run the rest separately.`);
});

const copy = (text, what) => guard('Copying', async () => {
  await call(api.copyText, { text });
  notify(`${what} copied to the clipboard.`, true);
});

/* ---------- views ---------- */

function viewReviews() {
  const f = state.form;
  const set = (key) => (e) => { f[key] = e.target.value; };
  const stores = (state.settings && state.settings.stores) || [];
  const form = h('div', {},
    h('h1', {}, 'Understand and answer your reviews'),
    h('p', { class: 'lead' }, 'Paste your app store reviews or open an export file. Claude sorts them into themes and drafts a reply to each one for you to edit.'),
    h('div', { class: 'grid3' },
      h('div', { class: 'field' }, h('label', { for: 'app' }, 'App name'), h('input', { id: 'app', value: f.appName, oninput: set('appName') })),
      h('div', { class: 'field' }, h('label', { for: 'store' }, 'Store'),
        h('select', { id: 'store', onchange: set('store') }, stores.map((s) => h('option', { value: s.id, selected: s.id === f.store }, `${s.label} (${s.limit}-character replies)`)))),
      h('div', { class: 'field' }, h('label', { for: 'tone' }, 'Tone'),
        h('select', { id: 'tone', onchange: set('tone') },
          h('option', { value: 'friendly', selected: f.tone === 'friendly' }, 'Friendly'),
          h('option', { value: 'professional', selected: f.tone === 'professional' }, 'Professional')))),
    h('div', { class: 'field wide' }, h('label', { for: 'contact' }, 'Support email or address to point people to (optional)'),
      h('input', { id: 'contact', value: f.contact, oninput: set('contact'), spellcheck: 'false', placeholder: 'support@example.com' }),
      h('span', { class: 'hint' }, 'Leave empty and replies will refer to the support option inside your app.')),
    h('div', { class: 'field wide' }, h('label', { for: 'text' }, 'Reviews'),
      h('textarea', { id: 'text', value: f.text, oninput: (e) => { f.text = e.target.value; state.fileName = ''; }, placeholder: 'One review per paragraph, with a blank line between them. Start a review with its rating if you have it, for example:\n\n2 stars: Keeps logging me out.\n\n★★★★★ Love the offline mode.' }),
      h('span', { class: 'hint' }, state.fileName ? `Loaded from ${state.fileName}. ` : '', 'Or open a CSV export from Google Play Console or App Store Connect. Up to 80 reviews per run.')),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: analyse, disabled: !!state.busy }, state.busy === 'Analysing' ? 'Analysing…' : state.result ? 'Analyse again' : 'Analyse and draft replies'),
      h('button', { class: 'btn ghost', onclick: openFile, disabled: !!state.busy }, 'Open file…'),
      state.busy === 'Analysing' ? h('span', { class: 'muted' }, h('span', { class: 'spin' }), 'Claude is reading the reviews. This can take a minute.') : null));

  const r = state.result;
  if (!r) return form;

  const all = () => r.reviews.filter((x) => x.reply).map((x) => `${x.rating ? `${x.rating}/5 ` : ''}${x.text}\n> ${x.reply}`).join('\n\n');
  return h('div', {}, form, h('hr', {}),
    h('h1', {}, `${plural(r.reviews.length, 'review')}, ${plural(r.themes.length, 'theme')}`),
    h('p', { class: 'summary' }, r.overview),
    r.missingReplies ? h('p', { class: 'facts' }, `${plural(r.missingReplies, 'review')} got no draft. Write those yourself or analyse again.`) : null,
    h('h2', {}, 'Themes'),
    r.themes.length ? h('div', { class: 'themes' }, r.themes.map(theme)) : h('p', { class: 'muted' }, 'No common themes found.'),
    h('h2', {}, 'Replies'),
    h('p', { class: 'facts' }, 'Read each draft before you post it in your store console. Earshot does not post anything, and Claude does not know your plans, so drafts never promise a fix or a date.'),
    r.reviews.map((x) => review(x, r.limit)),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', disabled: !!state.busy, onclick: () => copy(all(), 'All reviews and replies') }, 'Copy all'),
      h('button', { class: 'btn ghost', disabled: !!state.busy, onclick: () => guard('Saving', async () => { const s = await call(api.saveCsv, { reviews: r.reviews }); if (s.saved) notify(`Saved to ${s.path}`, true); }) }, 'Save as spreadsheet (CSV)')));
}

function theme(t) {
  return h('div', { class: 'theme' },
    h('div', { class: 'top' }, h('h3', {}, t.name), h('span', { class: 'n' }, plural(t.reviewIds.length, 'review'))),
    h('div', { class: 'kind' }, KIND[t.kind] || 'Other'),
    h('p', {}, t.summary),
    t.suggestion ? h('p', { class: 'do' }, t.suggestion) : null);
}

function review(x, limit) {
  const count = h('span', {});
  const update = () => {
    const n = x.reply.length;
    count.textContent = n > limit ? `${n} of ${limit} characters: too long for this store` : `${n} of ${limit} characters`;
    count.className = n > limit ? 'over' : '';
  };
  update();
  return h('article', { class: 'rev' },
    h('div', {},
      h('div', { class: 'meta' }, x.rating ? h('span', { class: 'stars', 'aria-label': `${x.rating} out of 5 stars` }, '★'.repeat(x.rating) + '☆'.repeat(5 - x.rating)) : 'No rating', x.date ? ` · ${x.date}` : ''),
      h('div', { class: 'body' }, x.text),
      x.themes.length ? h('div', { class: 'tags' }, x.themes.map((t) => h('span', {}, t))) : null),
    h('div', {},
      h('textarea', { 'aria-label': 'Reply', value: x.reply, placeholder: 'No draft. Write a reply here.', oninput: (e) => { x.reply = e.target.value; update(); } }),
      h('div', { class: 'under' }, count, h('button', { class: 'btn ghost small', disabled: !!state.busy, onclick: () => copy(x.reply, 'Reply') }, 'Copy reply'))));
}

function viewSettings() {
  const s = state.settings || { models: [] };
  const fields = {};
  const save = () => guard('Saving', async () => {
    await call(api.saveSettings, { model: fields.model.value, anthropicKey: fields.key.value });
    state.settings = await call(api.getSettings);
    notify('Settings saved.', true);
  });
  return h('div', {},
    h('h1', {}, 'Settings'),
    h('p', { class: 'lead' }, 'Your key is encrypted on this computer and is sent only to Anthropic. Earshot has no server of its own and does not connect to your store account.'),
    h('div', { class: 'field' },
      h('label', { for: 'key' }, 'Anthropic API key'),
      fields.key = h('input', { id: 'key', type: 'password', autocomplete: 'off', placeholder: s.hasAnthropicKey ? 'Saved. Enter a new key to replace it.' : 'sk-ant-…' }),
      h('span', { class: 'hint' }, 'Each run is billed to this key. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); api.openExternal({ url: 'https://console.anthropic.com/settings/keys' }); } }, 'Get a key'))),
    h('div', { class: 'field' },
      h('label', { for: 'model' }, 'Claude model'),
      fields.model = h('select', { id: 'model' }, s.models.map((m) => h('option', { value: m.id, selected: m.id === s.model }, m.label)))),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: save, disabled: !!state.busy }, 'Save settings')));
}

function render() {
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.view === state.view);
  $('view').replaceChildren((state.view === 'settings' ? viewSettings : viewReviews)());
}

/* ---------- start ---------- */

$('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (!b) return;
  state.view = b.dataset.view;
  notify('');
  render();
});

(async function start() {
  try {
    state.settings = await call(api.getSettings);
    if (!state.settings.hasAnthropicKey) {
      state.view = 'settings';
      notify('Welcome. Add your Anthropic API key to get started.', true);
    }
  } catch (err) {
    notify(err.message);
  }
  render();
})();
