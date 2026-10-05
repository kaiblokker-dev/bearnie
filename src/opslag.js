// ---------- Lokale opslag (IndexedDB, met localStorage als terugvaloptie) ----------

const Opslag = {
  DB_NAAM: 'meettool-administratieve-processen',
  STORE: 'gegevens',
  SLEUTEL: 'staat',
  db: null,
  modus: 'geen', // 'indexeddb' | 'localstorage' | 'geen'
  laatsteOpslag: null,
  wachtrij: Promise.resolve(),
  bezig: 0, // aantal opslagacties dat nog niet is afgerond

  async open() {
    try {
      if (!window.indexedDB) throw new Error('IndexedDB niet beschikbaar');
      this.db = await new Promise((resolve, reject) => {
        const verzoek = indexedDB.open(this.DB_NAAM, 1);
        verzoek.onupgradeneeded = () => {
          if (!verzoek.result.objectStoreNames.contains(this.STORE)) verzoek.result.createObjectStore(this.STORE);
        };
        verzoek.onsuccess = () => resolve(verzoek.result);
        verzoek.onerror = () => reject(verzoek.error);
        verzoek.onblocked = () => reject(new Error('Database geblokkeerd'));
      });
      this.modus = 'indexeddb';
    } catch (e) {
      try {
        const test = '__meettool_test__';
        localStorage.setItem(test, '1');
        localStorage.removeItem(test);
        this.modus = 'localstorage';
      } catch (e2) {
        this.modus = 'geen';
      }
    }
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (e) { /* niet kritiek */ }
    return this.modus;
  },

  async laad() {
    if (this.modus === 'indexeddb') {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(this.STORE, 'readonly');
        const verzoek = tx.objectStore(this.STORE).get(this.SLEUTEL);
        verzoek.onsuccess = () => resolve(verzoek.result ? JSON.parse(verzoek.result) : null);
        verzoek.onerror = () => reject(verzoek.error);
      });
    }
    if (this.modus === 'localstorage') {
      const t = localStorage.getItem(this.DB_NAAM);
      return t ? JSON.parse(t) : null;
    }
    return null;
  },

  /** Slaat de volledige staat op. Opslagacties worden na elkaar uitgevoerd. */
  bewaar(staat) {
    const tekst = JSON.stringify(staat);
    this.bezig++;
    this.wachtrij = this.wachtrij.then(() => this._schrijf(tekst)).then(
      () => { this.bezig--; this.laatsteOpslag = new Date(); return true; },
      (fout) => { this.bezig--; console.error(fout); throw fout; }
    );
    return this.wachtrij.catch((fout) => { this.wachtrij = Promise.resolve(); throw fout; });
  },

  _schrijf(tekst) {
    if (this.modus === 'indexeddb') {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(this.STORE, 'readwrite');
        tx.objectStore(this.STORE).put(tekst, this.SLEUTEL);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Opslaan afgebroken'));
      });
    }
    if (this.modus === 'localstorage') {
      localStorage.setItem(this.DB_NAAM, tekst);
      return Promise.resolve();
    }
    return Promise.reject(new Error('Er is geen lokale opslag beschikbaar in deze browser.'));
  },
};
