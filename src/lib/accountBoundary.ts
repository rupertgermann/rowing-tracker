interface AccountBoundary {
  enter(owner: string): boolean;
  retire(): void;
  getSnapshot(): string | undefined;
  subscribe(listener: () => void): () => void;
}
const boundaries = new WeakMap<Window, AccountBoundary>();

export const ACCOUNT_OWNER_KEY = 'rowing_account_owner';
const LEGACY_QUARANTINE_KEY = 'rowing_legacy_quarantine';
const LEGACY_RECORD_KEYS = ['rowing-tracker-storage', 'rowingSessions', 'personalRecords', 'trainingPlans', 'earnedAwards'];

export function isLegacyDataQuarantined(storage: Storage): boolean {
  return storage.getItem(LEGACY_QUARANTINE_KEY) === 'in-place';
}

function clearAccountStorage(storage: Storage) {
  const preserveLegacy = isLegacyDataQuarantined(storage) ||
    (storage.getItem(ACCOUNT_OWNER_KEY) === null && storage.getItem(LEGACY_QUARANTINE_KEY) === null);
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i)!;
    if (key === ACCOUNT_OWNER_KEY || key === LEGACY_QUARANTINE_KEY ||
      (preserveLegacy && LEGACY_RECORD_KEYS.includes(key))) continue;
    if (/^(rowing[_-]|chat_message_collapsed_|selectedWeek_|aiInsightsFeedback_)/.test(key) ||
      ['rowingSessions', 'personalRecords', 'trainingPlans', 'earnedAwards', 'migrationDismissed', 'migrationComplete'].includes(key)) {
      storage.removeItem(key);
    }
  }
  // Keep the only copy in place: duplicating legacy records can exceed localStorage quota.
  if (preserveLegacy) storage.setItem(LEGACY_QUARANTINE_KEY, 'in-place');
}

/** One document owns one account. A transition retires it before a fresh document initializes. */
export function createAccountBoundary(browser: Window): AccountBoundary {
  const existing = boundaries.get(browser);
  if (existing) return existing;
  let owner: string | undefined;
  let retired = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const controller = new AbortController();
  const retire = () => { retired = true; controller.abort(); notify(); };
  const originalFetch = browser.fetch.bind(browser);
  const assertCurrent = () => {
    if (owner !== undefined && browser.localStorage.getItem(ACCOUNT_OWNER_KEY) !== owner) retire();
    if (retired) throw new DOMException('Account changed', 'AbortError');
  };
  // Also guard body reads: an account can change after headers arrive but before JSON finishes.
  browser.fetch = async (input, init) => {
    assertCurrent();
    const signal = init && 'signal' in init ? init.signal : (input instanceof Request ? input.signal : undefined);
    const response = await originalFetch(input, { ...init, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal });
    assertCurrent();
    const json = response.json.bind(response);
    response.json = async () => {
      const data = await json();
      assertCurrent();
      return data;
    };
    return response;
  };

  const boundary: AccountBoundary = {
    enter(nextOwner: string): boolean {
      if (retired) return true;
      const storedOwner = browser.localStorage.getItem(ACCOUNT_OWNER_KEY);
      const changed = owner !== undefined && owner !== nextOwner;
      const staleStorage = storedOwner !== nextOwner;
      if (changed || staleStorage) {
        // Retire before clearing: old asynchronous work must never refill the new account's cache.
        retire();
        clearAccountStorage(browser.localStorage);
        browser.localStorage.setItem(ACCOUNT_OWNER_KEY, nextOwner);
      }
      owner = nextOwner;
      notify();
      return retired;
    },
    retire,
    getSnapshot: () => retired ? undefined : owner,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  boundaries.set(browser, boundary);
  return boundary;
}
