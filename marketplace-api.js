/* ═══════════════════════════════════════════════
   THE PUPPET SHED — Marketplace API (OrdinalsBot)
   Flow: check padding → setup padding → create-offer → sign → submit-offer
   Docs: https://docs.ordinalsbot.com/marketplace-api
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

  // ═══ HELPERS ═══

  // Wallet signPsbt returns hex, OrdinalsBot expects base64
  function hexToBase64(hex) {
    const bytes = hex.match(/.{1,2}/g).map(b => parseInt(b, 16));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToHex(b64) {
    const binary = atob(b64);
    let hex = '';
    for (let i = 0; i < binary.length; i++) {
      hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
  }

  // ═══ STATUS SYSTEM ═══

  let _onStatus = null;
  function onStatus(cb) { _onStatus = cb; }
  function _emit(status, data) { if (_onStatus) _onStatus(status, data); }

  // ═══ API CALLS ═══

  async function apiPost(path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `API error: ${res.status}`);
    }

    return res.json();
  }

  // ── Step 0a: Check if buyer has padding outputs ──
  // Padding outputs are small UTXOs the buyer needs to construct the PSBT.
  // If missing, we need to create them first.
  async function confirmPaddingOutputs(buyerPaymentAddress) {
    return apiPost('/marketplace/confirm-padding-outputs', {
      address: buyerPaymentAddress
    });
  }

  // ── Step 0b: Create padding outputs (buyer signs a setup tx) ──
  // Note: the API path has a typo ("ouputs") — this is intentional, it's the real path
  async function setupPaddingOutputs(buyerPaymentAddress, buyerPaymentPublicKey, feeRateTier = 'halfHourFee') {
    return apiPost('/marketplace/setup-padding-ouputs', {
      address: buyerPaymentAddress,
      publickey: buyerPaymentPublicKey,
      feerateTier: feeRateTier
    });
  }

  // ── Step 1: Create buy offer — returns PSBT for buyer to sign ──
  async function createBuyOffer(ordinalId, buyerPaymentAddress, buyerPaymentPublicKey, buyerOrdinalAddress, feeRateTier = 'halfHourFee') {
    if (!API_KEY) throw new Error('OrdinalsBot API key not configured. Request one at discord.ordinalsbot.com');

    _emit('preparing', { ordinalId });

    return apiPost('/marketplace/create-offer', {
      ordinalId,
      buyerPaymentAddress,
      buyerPaymentPublicKey,
      buyerOrdinalAddress,
      feerateTier: feeRateTier
    });
  }

  // ── Step 2: Submit signed offer ──
  async function submitOffer(ordinalId, signedBuyerPSBTBase64) {
    if (!API_KEY) throw new Error('OrdinalsBot API key not configured');

    _emit('broadcasting', {});

    const data = await apiPost('/marketplace/submit-offer', {
      ordinalId,
      signedBuyerPSBTBase64
    });

    _emit('confirmed', { txId: data.txid || data.txId });
    return data;
  }

  // ── Fetch active listings for a collection (POST, not GET) ──
  async function getListings(filter = {}, page = 1, itemsPerPage = 50, sort = 'priceAsc') {
    const body = {
      filter,
      page,
      itemsPerPage,
      sort
    };

    // getListings can work without an API key (public endpoint) but rate-limited
    const res = await fetch(`${BASE}/marketplace/get-listing`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Listings error: ${res.status}`);
    }

    return res.json();
  }

  // ═══ FULL BUY FLOW ═══
  // padding check → create offer → wallet signs → submit

  async function buyNow(inscriptionId, feeRateTier = 'halfHourFee') {
    const wallet = window._wallet;
    if (!wallet || !wallet.isConnected()) throw new Error('Wallet not connected');
    if (!API_KEY) throw new Error('OrdinalsBot API key not configured. Request one at discord.ordinalsbot.com');

    const state = wallet.getState();
    const buyerPaymentAddress = state.address;
    const buyerPaymentPublicKey = state.publicKey;
    const buyerOrdinalAddress = state.ordinalAddress;

    try {
      // ── Step 0: Check & setup padding outputs ──
      _emit('preparing', { message: 'Checking padding outputs...' });

      const paddingCheck = await confirmPaddingOutputs(buyerPaymentAddress);

      if (!paddingCheck.paddingOutputsOk && !paddingCheck.ok) {
        _emit('preparing', { message: 'Setting up padding outputs...' });

        const paddingSetup = await setupPaddingOutputs(
          buyerPaymentAddress,
          buyerPaymentPublicKey,
          feeRateTier
        );

        if (paddingSetup.psbt) {
          // Buyer needs to sign the padding setup tx
          _emit('sign', { message: 'Sign padding setup in your wallet...' });

          const psbtHex = base64ToHex(paddingSetup.psbt);
          const signedPaddingHex = await wallet.signPsbt(psbtHex, {
            inputsToSign: paddingSetup.inputsToSign || [],
            autoFinalize: true
          });
          const signedPaddingBase64 = hexToBase64(signedPaddingHex);

          // Submit the signed padding tx
          await apiPost('/marketplace/confirm-padding-outputs', {
            address: buyerPaymentAddress,
            psbt: signedPaddingBase64
          });

          // Wait for padding tx to propagate
          _emit('preparing', { message: 'Waiting for padding confirmation...' });
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      // ── Step 1: Create buy offer ──
      _emit('preparing', { message: 'Creating buy offer...' });

      const offer = await createBuyOffer(
        inscriptionId,
        buyerPaymentAddress,
        buyerPaymentPublicKey,
        buyerOrdinalAddress,
        feeRateTier
      );

      // ── Step 2: Sign the PSBT in wallet ──
      _emit('sign', { message: 'Confirm in your wallet...' });

      // OrdinalsBot returns base64 PSBT — convert to hex for wallet
      const psbtHex = base64ToHex(offer.psbt);
      const signedHex = await wallet.signPsbt(psbtHex, {
        inputsToSign: offer.inputsToSign || [],
        autoFinalize: true
      });

      // ── Step 3: Convert signed hex → base64 for API ──
      const signedBase64 = hexToBase64(signedHex);

      // ── Step 4: Submit signed offer ──
      const result = await submitOffer(inscriptionId, signedBase64);
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
    hasApiKey,
    confirmPaddingOutputs,
    setupPaddingOutputs,
    hexToBase64,
    base64ToHex
  };
})();
