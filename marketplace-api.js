/* ═══════════════════════════════════════════════
   THE PUPPET SHED — Marketplace API (OrdinalsBot)
   Buy flow: create-offer → sign PSBT → submit-offer
   ═══════════════════════════════════════════════ */

window._marketAPI = (() => {
  // OrdinalsBot marketplace API
  // TODO: Replace with your OrdinalsBot API key (request via https://discord.ordinalsbot.com)
  const API_KEY = '';
  const BASE = 'https://api.ordinalsbot.com';

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {})
  });

  // Transaction status callback
  let _onStatus = null;
  function onStatus(cb) { _onStatus = cb; }
  function _emit(status, data) { if (_onStatus) _onStatus(status, data); }

  // Create a buy offer — returns PSBT for the buyer to sign
  async function createBuyOffer(inscriptionId, buyerAddress, buyerPublicKey, feeRate = 'medium') {
    if (!API_KEY) throw new Error('OrdinalsBot API key not configured. Request one at discord.ordinalsbot.com');

    _emit('preparing', { inscriptionId });

    const res = await fetch(`${BASE}/marketplace/create-offer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        inscriptionId,
        buyerAddress,
        buyerPublicKey,
        feeRate
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${res.status}`);
    }

    const data = await res.json();
    _emit('sign', { psbt: data.psbt, inputsToSign: data.inputsToSign });
    return data;
  }

  // Submit signed PSBT to broadcast
  async function submitOffer(signedPsbt) {
    if (!API_KEY) throw new Error('OrdinalsBot API key not configured');

    _emit('broadcasting', {});

    const res = await fetch(`${BASE}/marketplace/submit-offer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ signedPsbt })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Submit error: ${res.status}`);
    }

    const data = await res.json();
    _emit('confirmed', { txId: data.txId });
    return data;
  }

  // Get active listings for a collection
  async function getListings(collectionSlug, offset = 0, limit = 50) {
    const res = await fetch(`${BASE}/marketplace/get-listing?collectionSlug=${collectionSlug}&offset=${offset}&limit=${limit}`, {
      headers: headers()
    });

    if (!res.ok) throw new Error(`Listings error: ${res.status}`);
    return res.json();
  }

  // Full buy flow: create offer → wallet signs → submit
  async function buyNow(inscriptionId, feeRate = 'medium') {
    const wallet = window._wallet;
    if (!wallet || !wallet.isConnected()) throw new Error('Wallet not connected');

    const state = wallet.getState();
    try {
      // Step 1: Create offer
      const offer = await createBuyOffer(
        inscriptionId,
        state.address,
        state.publicKey,
        feeRate
      );

      // Step 2: Sign PSBT in wallet
      _emit('sign', { message: 'Confirm in your wallet...' });
      const signedPsbt = await wallet.signPsbt(offer.psbt, {
        inputsToSign: offer.inputsToSign,
        autoFinalize: true
      });

      // Step 3: Submit signed tx
      const result = await submitOffer(signedPsbt);
      return result;
    } catch (err) {
      _emit('error', { message: err.message });
      throw err;
    }
  }

  function hasApiKey() {
    return !!API_KEY;
  }

  return {
    createBuyOffer,
    submitOffer,
    getListings,
    buyNow,
    onStatus,
    hasApiKey
  };
})();
