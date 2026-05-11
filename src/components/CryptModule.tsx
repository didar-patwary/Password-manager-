import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { encryptPayload, decryptString } from '../lib/dbEngine';

interface CryptModuleProps {
  encryptionEnabled: boolean;
  onToggleEncryption: (enabled: boolean) => void;
  secretKey: string;
  onUpdateSecretKey: (key: string) => void;
}

export default function CryptModule({
  encryptionEnabled,
  onToggleEncryption,
  secretKey,
  onUpdateSecretKey
}: CryptModuleProps) {
  const [showKey, setShowKey] = useState(false);
  const [playgroundPlaintxt, setPlaygroundPlaintxt] = useState('My super private local journal entry');
  const [decryptPlaintxtInput, setDecryptPlaintxtInput] = useState('');
  const [decryptTryKey, setDecryptTryKey] = useState('');
  const [decryptedPlaygroundResult, setDecryptedPlaygroundResult] = useState('');

  // Evaluate password strength indicator
  const getPasswordStrength = () => {
    if (!secretKey) return { label: 'Empty (Inactive)', color: 'text-red-400 bg-red-500/10', pct: 0 };
    if (secretKey.length < 5) return { label: 'Weak (Vulnerable)', color: 'text-rose-400 bg-rose-500/10', pct: 25 };
    if (secretKey.length < 8) return { label: 'Medium (Standard)', color: 'text-amber-400 bg-amber-500/10', pct: 60 };
    return { label: 'Strong (Military Grade)', color: 'text-emerald-400 bg-emerald-500/10', pct: 100 };
  };

  const strength = getPasswordStrength();

  // Handle visual test encrypt
  const testPayload = { text: playgroundPlaintxt };
  const testEncrypted = secretKey && encryptionEnabled
    ? encryptPayload(testPayload, secretKey).text
    : 'Encryption Disabled (Check Master Switch)';

  const handleDecoderRun = () => {
    const res = decryptString(decryptPlaintxtInput, decryptTryKey);
    setDecryptedPlaygroundResult(res);
  };

  return (
    <div id="cryptography-suite-panel" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl relative z-10 animate-fade-in">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-fuchsia-400 animate-pulse" />
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-sans">
              Zero-Knowledge Client Encryption
            </h3>
            <span className="text-[10px] text-slate-500 font-mono block">
              In-browser encryption BEFORE data serialization
            </span>
          </div>
        </div>

        {/* Master Cryptic Trigger Switch */}
        <button
          type="button"
          id="toggle-encryption-switch"
          onClick={() => onToggleEncryption(!encryptionEnabled)}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border cursor-pointer ${
            encryptionEnabled
              ? 'bg-fuchsia-500/10 border-fuchsia-500/15 text-fuchsia-400 shadow-md shadow-fuchsia-500/10'
              : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-350 hover:bg-white/10'
          }`}
        >
          {encryptionEnabled ? (
            <>
              <Shield className="w-3.5 h-3.5" /> SECURE MODE: ON
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5" /> UNSECURED MODE
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Master Key Management */}
        <div className="space-y-4">
          <div className="space-y-3.5 bg-black/25 p-5 rounded-2xl border border-white/5 shadow-md">
            <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1">
              <Key className="w-4 h-4 text-fuchsia-400" /> PBKDF2 Symm Key Configuration
            </span>

            <div className="relative">
              <input
                id="crypto-passphrase-field"
                type={showKey ? 'text' : 'password'}
                value={secretKey}
                onChange={e => onUpdateSecretKey(e.target.value)}
                placeholder="Set local private passphrase..."
                className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-white font-mono focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/50"
              />
              <button
                type="button"
                id="reveal-passphrase-btn"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Indicator bar */}
            {secretKey && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-550 uppercase font-semibold">Passphrase Safety:</span>
                  <span className={`px-2 py-0.5 rounded-lg border font-bold ${
                    strength.pct <= 25 
                      ? 'text-rose-450 border-rose-500/10 ' + strength.color 
                      : strength.pct <= 60 
                        ? 'text-amber-450 border-amber-500/10 ' + strength.color 
                        : 'text-emerald-450 border-emerald-500/10 ' + strength.color
                  }`}>{strength.label}</span>
                </div>
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${strength.pct}%` }} 
                    className={`h-full transition-all duration-300 ${
                      strength.pct <= 25 ? 'bg-rose-500' : strength.pct <= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  ></div>
                </div>
              </div>
            )}
            
            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
              * The passphrase is saved locally to your sandbox environment. It is never transmitted across any servers or endpoints. Plaintexts are unreadable on static storage snapshots.
            </p>
          </div>

          {/* Visual Plaintext vs Ciphertext demo */}
          <div className="space-y-2 bg-black/15 p-4 rounded-2xl border border-white/5 shadow-inner">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 font-bold block mb-1">
              Active Payload Masking Matrix
            </span>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono font-bold text-slate-600 uppercase">Decrypted Payload (Memory)</span>
                <input
                  id="sandbox-plaintext-input"
                  type="text"
                  value={playgroundPlaintxt}
                  onChange={e => setPlaygroundPlaintxt(e.target.value)}
                  className="w-full text-[11px] bg-black/35 rounded-xl p-2.5 text-sky-400 focus:outline-none border border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-mono font-bold text-slate-600 uppercase">Ciphertext Payload (LocalStorage)</span>
                <div className="text-[10px] font-mono bg-black/35 border border-white/10 p-2.5 rounded-xl text-fuchsia-400 overflow-x-auto h-[38px] leading-relaxed select-all">
                  {testEncrypted}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Interactive Enigma Sandbox Decoder */}
        <div className="space-y-4 bg-black/25 p-5 rounded-2xl border border-white/5 shadow-lg">
          <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" /> Interactive Decipher Tool
          </span>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            Paste any HermitDB encrypted string and attempt to derive the plaintext. Test wrong passwords to observe mathematical failures.
          </p>

          <div className="space-y-3.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cipher-string-input" className="text-[9px] font-mono uppercase text-slate-550 block font-bold">Encrypted String</label>
                <input
                  id="cipher-string-input"
                  type="text"
                  placeholder="Paste §ENC[AES-256_PBKDF2]::...§"
                  className="w-full text-xs font-mono bg-black/35 border border-white/10 rounded-xl p-2.5 text-teal-400 focus:outline-none focus:border-blue-500"
                  value={decryptPlaintxtInput}
                  onChange={e => setDecryptPlaintxtInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="try-secret-key-input" className="text-[9px] font-mono uppercase text-slate-550 block font-bold">Try Key Passphrase</label>
                <input
                  id="try-secret-key-input"
                  type="text"
                  placeholder="Enter key to decode"
                  className="w-full text-xs font-mono bg-black/35 border border-white/10 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  value={decryptTryKey}
                  onChange={e => setDecryptTryKey(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              id="submit-decoder-run-btn"
              onClick={handleDecoderRun}
              className="w-full bg-amber-500/10 hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 border border-amber-500/15 py-3 px-4 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-amber-600/5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin-slow" /> Decode Ciphertext
            </button>

            {decryptedPlaygroundResult && (
              <div className="space-y-2 border-t border-white/5 pt-3 animate-fade-in">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Decoder Output Plaintext</span>
                <div className={`p-3 rounded-xl font-mono text-xs border ${
                  decryptedPlaygroundResult.includes('Decryption Error')
                    ? 'bg-rose-500/5 border-rose-500/10 text-rose-400'
                    : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 font-bold'
                }`}>
                  {decryptedPlaygroundResult}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
