// Vlastní dialogy místo window.prompt / confirm / alert (fungují i v zabalených prostředích bez povolených modálů,
// vypadají jednotně a jdou testovat). Všechny vracejí Promise.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function otevri(html, { zrusitLze = true } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `<form method="dialog" class="dlg__form">${html}</form>`;
    const hotovo = (v) => { if (dlg.open) dlg.close(); dlg.dataset.vysledek = JSON.stringify(v ?? null); };
    dlg.addEventListener('close', () => { const v = dlg.dataset.vysledek ? JSON.parse(dlg.dataset.vysledek) : null; dlg.remove(); resolve(v); });
    dlg.addEventListener('cancel', (e) => { if (!zrusitLze) e.preventDefault(); });
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vysledek]'); if (!b) return;
      e.preventDefault();
      if (b.dataset.vysledek === 'ok') {
        const f = dlg.querySelector('form'); if (!f.reportValidity()) return;
        const pole = {}; new FormData(f).forEach((v, k) => { pole[k] = v; });
        dlg.querySelectorAll('input[type=checkbox]').forEach((c) => { pole[c.name] = c.checked; });
        hotovo({ ok: true, pole });
      } else hotovo({ ok: false });
    });
    document.body.appendChild(dlg); dlg.showModal();
    (dlg.querySelector('[autofocus]') || dlg.querySelector('input,select,textarea') || dlg.querySelector('[data-vysledek=ok]'))?.focus();
  });
}

export async function zeptejSe(text, vychozi = '', { popisek = '', typ = 'text' } = {}) {
  const r = await otevri(`<h2 class="dlg__titul">${esc(text)}</h2><label class="rk-field"><span class="rk-field__label">${esc(popisek || text)}</span><input class="rk-field__control" name="hodnota" type="${typ}" value="${esc(vychozi)}" autofocus required></label>
    <div class="dlg__akce"><button type="button" class="rk-btn rk-btn--secondary" data-vysledek="zrusit">Zrušit</button><button type="button" class="rk-btn rk-btn--primary" data-vysledek="ok">Potvrdit</button></div>`);
  return r?.ok ? r.pole.hodnota : null;
}

export async function potvrd(text, { ano = 'Potvrdit', nebezpecne = false, popis = '' } = {}) {
  const r = await otevri(`<h2 class="dlg__titul">${esc(text)}</h2>${popis ? `<p class="dlg__text">${esc(popis)}</p>` : ''}
    <div class="dlg__akce"><button type="button" class="rk-btn rk-btn--secondary" data-vysledek="zrusit" autofocus>Zrušit</button><button type="button" class="rk-btn ${nebezpecne ? 'rk-btn--danger' : 'rk-btn--primary'}" data-vysledek="ok">${esc(ano)}</button></div>`);
  return !!r?.ok;
}

export async function oznam(text, { titul = 'Upozornění' } = {}) {
  await otevri(`<h2 class="dlg__titul">${esc(titul)}</h2><p class="dlg__text">${esc(text)}</p><div class="dlg__akce"><button type="button" class="rk-btn rk-btn--primary" data-vysledek="ok" autofocus>Rozumím</button></div>`);
}

// Obecný dialog s vlastním obsahem (formulář); vrací {ok, pole} nebo {ok:false}.
export async function formular({ titul, html, ano = 'Potvrdit', zrusit = 'Zrušit', zrusitLze = true }) {
  const r = await otevri(`<h2 class="dlg__titul">${esc(titul)}</h2>${html}<div class="dlg__akce">${zrusitLze ? `<button type="button" class="rk-btn rk-btn--secondary" data-vysledek="zrusit">${esc(zrusit)}</button>` : ''}<button type="button" class="rk-btn rk-btn--primary" data-vysledek="ok">${esc(ano)}</button></div>`, { zrusitLze });
  return r || { ok: false };
}
