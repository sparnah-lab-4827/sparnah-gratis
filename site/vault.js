/* Private data is authenticated before the shopping app or any product image loads. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SparnahVaultCore = api; api.bootBrowser(root); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ACCESS_KEY = 'sparnah-private-access-v1';
  const DATA_URL = 'data/private.enc.json';
  const VERSION = '20261020-grundprodukte';
  const MAX_BYTES = 40 * 1024 * 1024;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const idValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  function bytes(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error('Ungültiges Zugriffsformat.');
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  }
  function parseAccess(value) {
    let entry = value;
    if (typeof entry === 'string') {
      if (entry.length > 4096) throw new Error('Die Zugriffsdatei ist zu groß.');
      try { entry = JSON.parse(entry); } catch { throw new Error('Bitte eine gültige Sparnah-Zugriffsdatei auswählen.'); }
    }
    if (!object(entry) || entry.format !== 'sparnah-access-v1' || !idValid(entry.datasetId) || typeof entry.key !== 'string' || entry.key.length !== 43 || bytes(entry.key).length !== 32) throw new Error('Bitte eine gültige Sparnah-Zugriffsdatei auswählen.');
    return { format: 'sparnah-access-v1', datasetId: entry.datasetId, key: entry.key };
  }
  function validateBundle(data) {
    if (!object(data) || data.schemaVersion !== 1 || !object(data.catalog) || data.catalog.version !== 2 || !['stores', 'products', 'offers'].every(k => Array.isArray(data.catalog[k])) || !object(data.assortment) || !Array.isArray(data.assortment.products) || !object(data.assortment.sources) || !object(data.leaflets) || !Array.isArray(data.leaflets.leaflets) || !object(data.status)) throw new Error('Der private Datenbestand hat ein ungültiges Format.');
    return data;
  }
  async function decompressGzip(plaintext) {
    const reader = new Blob([plaintext]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Der Datenbestand ist zu groß.'); }
        chunks.push(value);
      }
      const result = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
      return result;
    } finally { for (const chunk of chunks) chunk.fill(0); reader.releaseLock(); }
  }
  async function decryptEnvelope(envelope, accessValue, cryptoApi = globalThis.crypto) {
    const access = parseAccess(accessValue);
    if (!object(envelope) || envelope.schemaVersion !== 1 || envelope.algorithm !== 'AES-256-GCM' || (envelope.compression !== undefined && envelope.compression !== 'gzip') || envelope.datasetId !== access.datasetId || !idValid(envelope.datasetId) || typeof envelope.iv !== 'string' || envelope.iv.length !== 16 || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > MAX_BYTES || envelope.ciphertext.length < 23) throw new Error('Zugriffsdatei und Datenbestand passen nicht zusammen.');
    const iv = bytes(envelope.iv), ciphertext = bytes(envelope.ciphertext);
    if (iv.length !== 12 || ciphertext.length < 17 || !cryptoApi?.subtle) throw new Error('Dieser Browser unterstützt die sichere Freigabe nicht. Bitte HTTPS und einen aktuellen Browser verwenden.');
    let plaintext;
    try {
      const key = await cryptoApi.subtle.importKey('raw', bytes(access.key), { name: 'AES-GCM' }, false, ['decrypt']);
      plaintext = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('sparnah-vault:v1:' + access.datasetId), tagLength: 128 }, key, ciphertext);
    } catch { throw new Error('Die Daten konnten nicht sicher geöffnet werden. Bitte die passende Zugriffsdatei verwenden oder erneut versuchen.'); }
    let decoded = new Uint8Array(plaintext);
    try {
      if (envelope.compression === 'gzip') decoded = await decompressGzip(plaintext);
      if (decoded.byteLength > MAX_BYTES) throw new Error('Der Datenbestand ist zu groß.');
      return validateBundle(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded)));
    }
    catch { throw new Error('Der private Datenbestand hat ein ungültiges Format.'); }
    finally { decoded.fill(0); new Uint8Array(plaintext).fill(0); }
  }
  function createVault(deps) {
    let access = null, data = null, inFlight = null, startInFlight = null, lastRefresh = 0, generation = 0, started = false;
    let status = { unlocked: false, offline: false, error: '' };
    const listeners = new Set();
    const now = deps.now || Date.now;
    async function load(candidate) {
      let envelope, bundle;
      try {
        envelope = await deps.fetchEnvelope();
        bundle = await decryptEnvelope(envelope, candidate, deps.crypto);
      }
      catch {
        try { envelope = await deps.cache.get(candidate.datasetId); } catch {}
        if (!envelope) throw new Error('Die Daten sind nicht erreichbar oder konnten nicht sicher geöffnet werden. Bitte Internetverbindung und Zugriffsdatei prüfen.');
        // A damaged update must never replace the last authenticated offline copy.
        bundle = await decryptEnvelope(envelope, candidate, deps.crypto);
        return { bundle, offline: true, cacheAvailable: true, error: 'Die Daten konnten nicht aktualisiert werden. Der letzte sicher gespeicherte Stand bleibt sichtbar.' };
      }
      let cacheAvailable = true;
      try { await deps.cache.put(candidate.datasetId, envelope); } catch { cacheAvailable = false; }
      return { bundle, offline: false, cacheAvailable };
    }
    function publish(result) {
      data = result.bundle;
      status = { unlocked: true, offline: result.offline, checking: !!result.checking, cacheAvailable: result.cacheAvailable, error: result.error || '' };
      if (!result.checking) lastRefresh = now();
      for (const fn of listeners) fn(data, { ...status });
      return { ok: true, ...status };
    }
    async function finishUnlock(candidate, result, ticket) {
      if (ticket !== generation) throw new Error('Die Freigabe wurde abgebrochen.');
      access = candidate;
      try { deps.storage.setItem(ACCESS_KEY, JSON.stringify(candidate)); } catch {}
      const response = publish(result);
      if (!started) {
        if (!startInFlight) startInFlight = Promise.resolve().then(() => deps.onUnlock?.()).then(() => { started = true; }).finally(() => { startInFlight = null; });
        await startInFlight;
      }
      return response;
    }
    async function unlock(value) {
      const candidate = parseAccess(value), ticket = ++generation;
      return finishUnlock(candidate, await load(candidate), ticket);
    }
    function refresh(force = false) {
      if (!access) return Promise.reject(new Error('Bitte Sparnah zuerst freigeben.'));
      if (inFlight) return inFlight;
      if (!force && now() - lastRefresh < 10 * 60 * 1000) return Promise.resolve({ ok: true, ...status });
      const ticket = generation, candidate = access;
      inFlight = (async () => {
        try {
          const result = await load(candidate);
          if (ticket !== generation) return { ok: false };
          return publish(result);
        } catch (error) {
          if (ticket === generation) { status = { ...status, error: 'Die privaten Daten konnten nicht aktualisiert werden. Der letzte geprüfte Stand bleibt sichtbar.' }; for (const fn of listeners) fn(data, { ...status }); }
          throw error;
        } finally { inFlight = null; }
      })();
      return inFlight;
    }
    async function restore() {
      let value;
      try { value = deps.storage.getItem(ACCESS_KEY); } catch {}
      if (!value) return false;
      const candidate = parseAccess(value), ticket = ++generation;
      let cached;
      try {
        const envelope = await deps.cache.get(candidate.datasetId);
        if (envelope) cached = await decryptEnvelope(envelope, candidate, deps.crypto);
      } catch {} // An invalid local copy can only be replaced by authenticated network data.
      if (cached) {
        await finishUnlock(candidate, {bundle:cached, offline:false, checking:true, cacheAvailable:true}, ticket);
        if (ticket === generation) void refresh(true).catch(() => {});
      } else {
        await finishUnlock(candidate, await load(candidate), ticket);
      }
      return true;
    }
    function lock() {
      generation++; access = null; data = null; status = { unlocked: false, offline: false, error: '' };
      try { deps.storage.removeItem(ACCESS_KEY); } catch {}
      deps.onLock?.();
    }
    return { unlock, restore, refresh, lock, getData: () => data, getStatus: () => ({ ...status }), subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, exportAccess() { if (!access) throw new Error('Sparnah ist gesperrt.'); return JSON.stringify(access, null, 2); } };
  }
  function indexedCache(win) {
    const database = () => new Promise((resolve, reject) => {
      const request = win.indexedDB.open('sparnah-encrypted-data-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('envelopes');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Offline-Speicher nicht verfügbar.'));
      request.onblocked = () => reject(new Error('Offline-Speicher ist belegt.'));
    });
    async function run(mode, operation) {
      const db = await database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('envelopes', mode), request = operation(tx.objectStore('envelopes'));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Offline-Speicher nicht verfügbar.')); };
      });
    }
    return { get: id => run('readonly', store => store.get(id)), put: (id, envelope) => run('readwrite', store => store.put(envelope, id)) };
  }
  function takeFragment(win) {
    if (!win.location.hash.startsWith('#access=')) return null;
    const fragment = win.location.hash.slice(8);
    // Consume even an invalid link before any request or UI message.
    win.history.replaceState(null, '', win.location.pathname + win.location.search);
    if (fragment.length > 6000) throw new Error('Der Freigabelink ist ungültig.');
    try { return parseAccess(new TextDecoder('utf-8', { fatal: true }).decode(bytes(fragment))); }
    catch { throw new Error('Der Freigabelink ist ungültig. Bitte stattdessen die Zugriffsdatei auswählen.'); }
  }
  function bootBrowser(win) {
    const doc = win.document, input = doc.getElementById('access-file'), button = doc.getElementById('access-open'), message = doc.getElementById('access-message');
    let busy = false;
    const say = (text, error = false) => { message.textContent = text; message.classList.toggle('error-text', error); };
    let activation, activationError;
    try { activation = takeFragment(win); } catch (error) { activationError = error; }
    const storage = { getItem: key => win.localStorage.getItem(key), setItem: (key, value) => win.localStorage.setItem(key, value), removeItem: key => win.localStorage.removeItem(key) };
    const vault = createVault({ storage, cache: indexedCache(win), crypto: win.crypto,
      async fetchEnvelope() {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90000);
        try {
          const response = await win.fetch(DATA_URL, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
          if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Daten nicht erreichbar.');
          const text = await response.text(); if (text.length > MAX_BYTES) throw new Error('Daten zu groß.');
          return JSON.parse(text);
        } finally { clearTimeout(timer); }
      },
      async onUnlock() {
        const script = doc.createElement('script'); script.src = 'app.js?v=' + VERSION;
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => { script.remove(); reject(new Error('Die App konnte nicht geladen werden. Bitte erneut freigeben.')); }; doc.head.appendChild(script); });
        if (!vault.getData()) return;
        doc.getElementById('vault-screen').hidden = true;
        doc.body.classList.remove('vault-locked');
        doc.getElementById('main').focus();
      },
      onLock() {
        doc.body.classList.add('vault-locked');
        doc.getElementById('dialog').close();
        for (const id of ['header', 'main', 'side-nav', 'bottom-nav', 'dialog-content', 'toast']) doc.getElementById(id).replaceChildren();
        doc.getElementById('vault-screen').hidden = false;
        win.location.replace(win.location.pathname + win.location.search);
      }
    });
    win.SparnahVault = { getData: vault.getData, getStatus: vault.getStatus, refresh: vault.refresh, subscribe: vault.subscribe, lock: vault.lock,
      exportAccess() {
        if (/SparnahAndroid\//.test(win.navigator?.userAgent || '')) { win.prompt('sparnah-save:sparnah-zugriff.json', vault.exportAccess()); return; }
        const blob = new Blob([vault.exportAccess()], { type: 'application/json' }), url = URL.createObjectURL(blob), link = doc.createElement('a');
        link.href = url; link.download = 'sparnah-zugriff.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    };
    async function activate(value) {
      if (busy) return;
      busy = true; button.disabled = true; say('Private Daten werden sicher geöffnet …');
      try { await vault.unlock(value); say(''); }
      catch (error) { say(error.message, true); }
      finally { busy = false; button.disabled = false; input.value = ''; }
    }
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      if (file.size > 4096) { say('Bitte die kleine Sparnah-Zugriffsdatei auswählen, keine Listensicherung.', true); input.value = ''; return; }
      try { await activate(await file.text()); } catch { say('Die Datei konnte nicht gelesen werden.', true); }
    });
    win.addEventListener('storage', event => { if (event.key === ACCESS_KEY && event.newValue === null && vault.getData()) vault.lock(); });
    if ('serviceWorker' in win.navigator && win.isSecureContext) win.navigator.serviceWorker.register('sw.js').catch(() => {});
    if (activationError) { say(activationError.message, true); return; }
    if (activation) { void activate(activation); return; }
    busy = true; button.disabled = true;
    vault.restore().catch(error => say(error.message, true)).finally(() => { busy = false; button.disabled = false; });
  }
  return { ACCESS_KEY, DATA_URL, parseAccess, validateBundle, decryptEnvelope, createVault, takeFragment, bootBrowser };
});
