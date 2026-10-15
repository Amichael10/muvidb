const CLIPPER_ORIGIN = 'http://127.0.0.1:4317';
let pairing = null;

async function pairingToken() {
  if (!pairing) {
    pairing = fetch(`${CLIPPER_ORIGIN}/health`).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.pairing_token) throw new Error('Restart the desktop clipper to connect securely.');
      return data.pairing_token;
    }).catch(error => { pairing = null; throw error; });
  }
  return pairing;
}

// Preserve ordinary API/storage fetches; pair only with the loopback clipper.
export async function fetchWithLocalClipperAuth(input, init = {}) {
  const target = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
  if (target.origin !== CLIPPER_ORIGIN || target.pathname === '/health') return fetch(input, init);
  const perform = async () => {
    const headers = new Headers(init.headers);
    headers.set('X-Muvidb-Clipper-Token', await pairingToken());
    return fetch(input, { ...init, headers });
  };
  let response = await perform();
  if (response.status === 401) {
    pairing = null;
    response = await perform();
  }
  return response;
}
