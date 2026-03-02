/* ═══════════════════════════════════════════════
   THE PUPPET SHED — Wallet Abstraction
   Supports: Phantom (default), Unisat, Xverse, Leather
   ═══════════════════════════════════════════════ */

window._wallet = (() => {
  let _state = null; // { address, ordinalAddress, publicKey, provider, providerName }

  const PROVIDERS = {
    phantom: {
      name: 'Phantom',
      icon: '👻',
      accent: '#AB9FF2',
      recommended: true,
      check: () => !!window.phantom?.bitcoin,
      installUrl: 'https://phantom.app/',
      async connect() {
        const accounts = await window.phantom.bitcoin.requestAccounts();
        const payment = accounts.find(a => a.purpose === 'payment') || accounts[0];
        const ordinals = accounts.find(a => a.purpose === 'ordinals') || payment;
        return {
          address: payment.address,
          ordinalAddress: ordinals.address,
          publicKey: payment.publicKey,
          provider: window.phantom.bitcoin,
          providerName: 'phantom'
        };
      },
      async signPsbt(psbtData, opts = {}) {
        // Phantom expects Uint8Array for PSBT input
        let psbtBytes;
        if (psbtData instanceof Uint8Array) {
          psbtBytes = psbtData;
        } else if (typeof psbtData === 'string') {
          if (/^[0-9a-fA-F]+$/.test(psbtData)) {
            psbtBytes = new Uint8Array(psbtData.match(/.{1,2}/g).map(b => parseInt(b, 16)));
          } else {
            const bin = atob(psbtData);
            psbtBytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) psbtBytes[i] = bin.charCodeAt(i);
          }
        }

        const inputsToSign = [];
        if (opts.inputsToSign && Array.isArray(opts.inputsToSign)) {
          inputsToSign.push(...opts.inputsToSign);
        }

        const signedBytes = await window.phantom.bitcoin.signPSBT(psbtBytes, {
          inputsToSign
        });

        // Return hex string for compatibility
        return Array.from(new Uint8Array(signedBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    },

    unisat: {
      name: 'Unisat',
      icon: '🟧',
      accent: '#F7931A',
      check: () => !!window.unisat,
      installUrl: 'https://unisat.io/download',
      async connect() {
        const accounts = await window.unisat.requestAccounts();
        const pubKey = await window.unisat.getPublicKey();
        const address = accounts[0];
        return {
          address,
          ordinalAddress: address,
          publicKey: pubKey,
          provider: window.unisat,
          providerName: 'unisat'
        };
      },
      async signPsbt(psbtHex, opts = {}) {
        return window.unisat.signPsbt(psbtHex, {
          autoFinalized: opts.autoFinalize !== false,
          toSignInputs: opts.inputsToSign || undefined
        });
      }
    },

    xverse: {
      name: 'Xverse',
      icon: '🟪',
      accent: '#EE7A30',
      check: () => !!window.BitcoinProvider,
      installUrl: 'https://www.xverse.app/download',
      async connect() {
        const resp = await window.BitcoinProvider.request('getAccounts', {
          purposes: ['ordinals', 'payment'],
          message: 'The Puppet Shed wants to connect'
        });
        const payment = resp.result.find(a => a.purpose === 'payment') || resp.result[0];
        const ordinals = resp.result.find(a => a.purpose === 'ordinals') || payment;
        return {
          address: payment.address,
          ordinalAddress: ordinals.address,
          publicKey: payment.publicKey,
          provider: window.BitcoinProvider,
          providerName: 'xverse'
        };
      },
      async signPsbt(psbtBase64, opts = {}) {
        const resp = await window.BitcoinProvider.request('signPsbt', {
          psbt: psbtBase64,
          signInputs: opts.signInputs || {},
          broadcast: opts.broadcast || false
        });
        return resp.result.psbt;
      }
    },

    okx: {
      name: 'OKX',
      icon: '⬛',
      accent: '#FFFFFF',
      check: () => !!window.okxwallet?.bitcoin,
      installUrl: 'https://www.okx.com/web3',
      async connect() {
        const result = await window.okxwallet.bitcoin.requestAccounts();
        const address = result[0];
        const pubKey = await window.okxwallet.bitcoin.getPublicKey();
        return {
          address,
          ordinalAddress: address,
          publicKey: pubKey,
          provider: window.okxwallet.bitcoin,
          providerName: 'okx'
        };
      },
      async signPsbt(psbtHex, opts = {}) {
        return window.okxwallet.bitcoin.signPsbt(psbtHex, {
          autoFinalized: opts.autoFinalize !== false,
          toSignInputs: opts.inputsToSign || undefined
        });
      }
    },

    leather: {
      name: 'Leather',
      icon: '🟫',
      accent: '#F5A623',
      check: () => !!window.LeatherProvider,
      installUrl: 'https://leather.io/install-extension',
      async connect() {
        const resp = await window.LeatherProvider.request('getAddresses');
        const addresses = resp.result.addresses;
        const payment = addresses.find(a => a.type === 'p2wpkh') || addresses[0];
        const ordinals = addresses.find(a => a.type === 'p2tr') || payment;
        return {
          address: payment.address,
          ordinalAddress: ordinals.address,
          publicKey: payment.publicKey,
          provider: window.LeatherProvider,
          providerName: 'leather'
        };
      },
      async signPsbt(psbtHex, opts = {}) {
        const resp = await window.LeatherProvider.request('signPsbt', {
          hex: psbtHex,
          signAtIndex: opts.inputsToSign || undefined,
          broadcast: opts.broadcast || false
        });
        return resp.result.hex;
      }
    }
  };

  function detect() {
    return Object.entries(PROVIDERS).map(([key, p]) => ({
      key,
      name: p.name,
      icon: p.icon,
      accent: p.accent || '#F7931A',
      recommended: !!p.recommended,
      installed: p.check(),
      installUrl: p.installUrl
    }));
  }

  async function connect(providerName) {
    const p = PROVIDERS[providerName];
    if (!p) throw new Error(`Unknown wallet: ${providerName}`);
    if (!p.check()) throw new Error(`${p.name} not installed`);

    _state = await p.connect();
    sessionStorage.setItem('shed_wallet', providerName);
    return _state;
  }

  function disconnect() {
    _state = null;
    sessionStorage.removeItem('shed_wallet');
  }

  async function signPsbt(psbtData, opts = {}) {
    if (!_state) throw new Error('Wallet not connected');
    const p = PROVIDERS[_state.providerName];
    return p.signPsbt(psbtData, opts);
  }

  function isConnected() {
    return !!_state;
  }

  function getState() {
    return _state;
  }

  function getProviderName() {
    return _state?.providerName || null;
  }

  function truncateAddress(addr) {
    if (!addr || addr.length < 12) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async function tryReconnect() {
    const saved = sessionStorage.getItem('shed_wallet');
    if (!saved) return null;
    const p = PROVIDERS[saved];
    if (!p || !p.check()) return null;
    try {
      _state = await p.connect();
      return _state;
    } catch {
      sessionStorage.removeItem('shed_wallet');
      return null;
    }
  }

  return {
    detect,
    connect,
    disconnect,
    signPsbt,
    isConnected,
    getState,
    getProviderName,
    truncateAddress,
    tryReconnect,
    PROVIDERS
  };
})();
