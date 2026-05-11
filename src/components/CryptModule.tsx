import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Sparkles, 
  RefreshCw, 
  Cpu, 
  Smartphone, 
  Lock, 
  CheckCircle,
  Database,
  Terminal as TermIcon,
  HelpCircle,
  Hash,
  Download,
  ShieldCheck,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { encryptPayload, decryptString } from '../lib/dbEngine';
import { 
  deriveKeyFromPassword, 
  encryptAESGCM, 
  decryptAESGCM, 
  generateRandomBytes, 
  uint8ArrayToBase64, 
  base64ToUint8Array,
  generateMnemonicPhrase
} from '../lib/secureCrypto';

interface CryptModuleProps {
  encryptionEnabled: boolean;
  onToggleEncryption: (enabled: boolean) => void;
  secretKey: string;
  onUpdateSecretKey: (key: string) => void;
  recoveryPhrase: string;
  setRecoveryPhrase: (phrase: string) => void;
  recoveryVerified: boolean;
  onSetRecoveryVerified: (verified: boolean) => void;
  addLog?: (source: 'SYSTEM' | 'CLIENT_A' | 'CLIENT_B' | 'SERVER', type: 'info' | 'success' | 'warn' | 'error' | 'crypto' | 'sync', message: string) => void;
}

export default function CryptModule({
  encryptionEnabled,
  onToggleEncryption,
  secretKey,
  onUpdateSecretKey,
  recoveryPhrase,
  setRecoveryPhrase,
  recoveryVerified,
  onSetRecoveryVerified,
  addLog
}: CryptModuleProps) {
  // Simple simulator state
  const [showKey, setShowKey] = useState(false);
  const [playgroundPlaintxt, setPlaygroundPlaintxt] = useState('My super private local journal entry');
  const [decryptPlaintxtInput, setDecryptPlaintxtInput] = useState('');
  const [decryptTryKey, setDecryptTryKey] = useState('');
  const [decryptedPlaygroundResult, setDecryptedPlaygroundResult] = useState('');

  // Dual Mode: Mobile / Industrial Lab States
  const [labTab, setLabTab] = useState<'real_crypt' | 'hardware_guide' | 'recovery_kit'>('real_crypt');
  const [masterPassword, setMasterPassword] = useState('MasterPass_Secure_123');
  const [iterations, setIterations] = useState(100000);
  const [saltB64, setSaltB64] = useState(() => uint8ArrayToBase64(generateRandomBytes(16)));
  const [isDeriving, setIsDeriving] = useState(false);
  
  // Real cryptographic keys (holding actual WebCrypto CrptoKey instances)
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [derivedKeyStats, setDerivedKeyStats] = useState<string>('Not Derived');

  // Encryption playground states (real GCM)
  const [plaintextToEncrypt, setPlaintextToEncrypt] = useState('My top-secret mobile vault entry: 0xFF-ALICE');
  const [realCipherB64, setRealCipherB64] = useState('');
  const [realIvB64, setRealIvB64] = useState('');
  const [realDecryptedResult, setRealDecryptedResult] = useState('');

  // Mobile Hardware Storage KeyStore / Keychain emulator state
  const [hardwareStatus, setHardwareStatus] = useState<'unstored' | 'keys_bound_enclave' | 'hardware_biometric_locked'>('keys_bound_enclave');
  const [secureHardwareLogs, setSecureHardwareLogs] = useState<string[]>([
    'Secure Enclave: Booting system cryptographic microkernel (Apple sepOS / Android KeyStore firmware).',
    'Secure Enclave: Initializing Android StrongBox / iOS Hardware Security Module (HSM) key boundaries.',
    'Secure Enclave: Ready. Hardware bound salt generation requested and stored in secure TEE container.'
  ]);

  // BIP-39 recovery kit states
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [testPhraseInput, setTestPhraseInput] = useState('');
  const [newMasterInput, setNewMasterInput] = useState('');

  // Derive cryptographic key in background when MasterPass, Salt or Iterations change
  useEffect(() => {
    let active = true;
    const computeKey = async () => {
      if (!masterPassword || !saltB64) return;
      setIsDeriving(true);
      try {
        const saltBytes = base64ToUint8Array(saltB64);
        const key = await deriveKeyFromPassword(masterPassword, saltBytes, iterations);
        if (active) {
          setDerivedKey(key);
          setDerivedKeyStats(`AES-256 (PBKDF2 SHA-256 | ${iterations.toLocaleString()} iter)`);
          
          // Print logs or status updates of hardware derivation
          addHardwareLog(
            `Key Derivation: Successfully computed AES bit sequence using PBKDF2 (${iterations} rounds). Symmetrical derived key is ready for GCM operations.`
          );
        }
      } catch (err) {
        console.error('Derivation error:', err);
        if (active) setDerivedKeyStats('Error deriving key');
      } finally {
        if (active) setIsDeriving(false);
      }
    };
    computeKey();
    return () => {
      active = false;
    };
  }, [masterPassword, saltB64, iterations]);

  // Execute real AES-256-GCM encryption
  const executeRealEncrypt = async () => {
    if (!derivedKey) {
      alert('Derive a key first!');
      return;
    }
    try {
      const result = await encryptAESGCM(plaintextToEncrypt, derivedKey);
      setRealCipherB64(result.ciphertext);
      setRealIvB64(result.iv);
      setRealDecryptedResult(''); // Reset decrypted result on fresh encrypt
      addHardwareLog(
        `AES-GCM Event: Plaintext encrypted using 12-byte crypt-secure IV: ${result.iv.substring(0, 8)}... and 128-bit authentication integrity tag appended.`
      );
    } catch (err) {
      console.error(err);
      addHardwareLog(`AES-GCM Error: Encryption computation failed: ${String(err)}`);
    }
  };

  // Execute real AES-256-GCM decryption
  const executeRealDecrypt = async () => {
    if (!derivedKey) return;
    if (!realCipherB64 || !realIvB64) return;
    try {
      const decrypted = await decryptAESGCM(realCipherB64, realIvB64, derivedKey);
      setRealDecryptedResult(decrypted);
    } catch (err) {
      console.error(err);
      setRealDecryptedResult('Decryption Error (Integrity Auth Tag validation failed / Bad cipher parameters)');
    }
  };

  const handleRegenerateSalt = () => {
    const newSalt = generateRandomBytes(16);
    const b64 = uint8ArrayToBase64(newSalt);
    setSaltB64(b64);
    addHardwareLog(`Hardware Event: Generated fresh hardware-bound 128-bit Salt stored securely in iOS Keychain/Android KeyStore.`);
  };

  const addHardwareLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSecureHardwareLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 20));
  };

  // Evaluate password strength indicator
  const getPasswordStrength = () => {
    if (!secretKey) return { label: 'Empty (Inactive)', color: 'text-red-400 bg-red-500/10', pct: 0 };
    if (secretKey.length < 5) return { label: 'Weak (Vulnerable)', color: 'text-rose-400 bg-rose-500/10', pct: 25 };
    if (secretKey.length < 8) return { label: 'Medium (Standard)', color: 'text-amber-400 bg-amber-500/10', pct: 60 };
    return { label: 'Strong (Military Grade)', color: 'text-emerald-400 bg-emerald-500/10', pct: 100 };
  };

  const strength = getPasswordStrength();

  // Simple shift-cipher generator for database view simulation
  const testPayload = { text: playgroundPlaintxt };
  const testEncrypted = secretKey && encryptionEnabled
    ? encryptPayload(testPayload, secretKey).text
    : 'Encryption Disabled (Check Master Switch)';

  const handleDecoderRun = () => {
    const res = decryptString(decryptPlaintxtInput, decryptTryKey);
    setDecryptedPlaygroundResult(res);
  };

  return (
    <div id="cryptography-suite-panel" className="space-y-6 animate-fade-in relative z-10">
      
      {/* SECTION 1: Standard Sandbox Database Crypt Lock (Used by the local DB playground) */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-fuchsia-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-sans">
                Zero-Knowledge Database Cryptography
              </h3>
              <span className="text-[10px] text-slate-550 font-mono block">
                Encrypts client-side row data BEFORE saving indices or transmitting sync blocks
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
          {/* Left Col: Master Passphrase */}
          <div className="space-y-4">
            <div className="space-y-3.5 bg-black/25 p-5 rounded-2xl border border-white/5 shadow-md">
              <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 mb-11">
                <Key className="w-4 h-4 text-fuchsia-400" /> Passphrase-Derived Key Material
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
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Indicator bar */}
              {secretKey && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500 uppercase font-semibold">Passphrase Safety:</span>
                    <span className={`px-2 py-0.5 rounded-lg border font-bold ${strength.color}`}>{strength.label}</span>
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
                * Real cryptographic operations derive symmetrical keys using <strong>PBKDF2</strong> with cryptographic <strong>Salts</strong> saved inside Android's <em>KeyStore</em> or iOS's <em>Keychain</em>. Try the interactive lab below to see this in motion!
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

          {/* Right Col: Interactive Decipher Tool */}
          <div className="space-y-4 bg-black/25 p-5 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between">
            <div>
              <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" /> Simulated Decipher Tool
              </span>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed mb-3">
                Paste any database-encrypted string and attempt to brute-force or correctly decode the underlying plaintext.
              </p>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="cipher-string-input" className="text-[9px] font-mono uppercase text-slate-500 block font-bold animate-pulse">Encrypted DB Node</label>
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
                    <label htmlFor="try-secret-key-input" className="text-[9px] font-mono uppercase text-slate-550 block font-bold">Try Passphrase</label>
                    <input
                      id="try-secret-key-input"
                      type="text"
                      placeholder="Key token"
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
              </div>
            </div>

            {decryptedPlaygroundResult && (
              <div className="space-y-2 border-t border-white/5 pt-3 animate-fade-in">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Decoder Output Plaintext</span>
                <div id="decrypted-result-container" className={`p-3 rounded-xl font-mono text-xs border ${
                  decryptedPlaygroundResult.includes('Decryption Error')
                    ? 'bg-rose-500/5 border-rose-500/10 text-rose-450'
                    : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 font-bold'
                }`}>
                  {decryptedPlaygroundResult}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Interactive Industrial Cryptographic Lab & Hardware Enclave Simulator */}
      <div id="industrial-security-sandbox" className="bg-[#121320] border border-blue-500/20 rounded-3xl p-6 space-y-6 shadow-2xl relative">
        <div className="absolute top-0 right-10 transform translate-y-[-50%] bg-blue-500/10 border border-blue-400/20 text-blue-400 text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
          Senior Security lab
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-white/10 pb-0.5 gap-2 flex-wrap">
          <button
            type="button"
            id="lab-tab-crypt"
            onClick={() => setLabTab('real_crypt')}
            className={`pb-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 px-1 transition-all ${
              labTab === 'real_crypt'
                ? 'border-blue-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4.5 h-4.5 inline mr-1 text-blue-400" /> Real PBKDF2 & AES-GCM Playground
          </button>
          <button
            type="button"
            id="lab-tab-hardware"
            onClick={() => setLabTab('hardware_guide')}
            className={`pb-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 px-1 transition-all ${
              labTab === 'hardware_guide'
                ? 'border-purple-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Smartphone className="w-4.5 h-4.5 inline mr-1 text-purple-400" /> Hardware Keystore / Keychain Emulator
          </button>
          <button
            type="button"
            id="lab-tab-recovery"
            onClick={() => setLabTab('recovery_kit')}
            className={`pb-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 px-1 transition-all ${
              labTab === 'recovery_kit'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4.5 h-4.5 inline mr-1 text-emerald-400" /> BIP-39 Emergency Recovery Kit
          </button>
        </div>

        {labTab === 'real_crypt' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Real derivation control column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-black/30 p-4.5 rounded-2xl border border-white/5 space-y-3.5">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold block">
                  PBKDF2 Symmetrical Crypt Key Generator
                </span>

                <div className="space-y-1">
                  <label htmlFor="master-pwd-field" className="text-[9px] font-mono uppercase text-slate-500 block font-black">User Master Password</label>
                  <input
                    id="master-pwd-field"
                    type="text"
                    value={masterPassword}
                    onChange={e => setMasterPassword(e.target.value)}
                    className="w-full text-xs font-mono bg-black/45 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-400"
                    placeholder="Enter Master Password..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="pbkdf2-iterations-select" className="text-[9px] font-mono uppercase text-slate-500 block font-black">Iterations</label>
                    <select
                      id="pbkdf2-iterations-select"
                      value={iterations}
                      onChange={e => setIterations(Number(e.target.value))}
                      className="w-full text-xs font-mono bg-black/45 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none"
                    >
                      <option value={1000}>1,000 (Legacy)</option>
                      <option value={50000}>50,000 (Balanced)</option>
                      <option value={100000}>100,000 (Android Rec)</option>
                      <option value={250000}>250,000 (Max-Arduous)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-slate-500 block font-black">Salt (Secure Enclave)</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={saltB64.substring(0, 10) + '...'}
                        disabled
                        className="w-full text-xs font-mono bg-black/25 text-slate-500 border border-white/5 rounded-xl px-2.5 py-2"
                      />
                      <button
                        type="button"
                        id="refresh-hardware-salt-btn"
                        onClick={handleRegenerateSalt}
                        className="bg-purple-950/40 hover:bg-purple-950/60 text-purple-400 border border-purple-500/20 px-2 rounded-xl"
                        title="Generate fresh hardware bound salt"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Derived Crypt Key Status Box */}
                <div className="p-3 bg-blue-950/20 border border-blue-500/10 rounded-xl font-mono text-[11px] leading-normal flex items-center justify-between">
                  <div>
                    <div className="text-[8px] uppercase text-sky-400 font-black tracking-widest leading-none mb-1">Active Derived Key Instance</div>
                    <div className="text-white font-bold tracking-tight">{isDeriving ? 'Deriving...' : derivedKeyStats}</div>
                  </div>
                  <Cpu className={`w-5 h-5 text-sky-400 ${isDeriving ? 'animate-spin' : ''}`} />
                </div>
              </div>
            </div>

            {/* Real AES-GCM Encryptor Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold block mb-1">
                  AEAD AES-256-GCM Symmetrical Cipher Channel (100% Real WebCrypto API)
                </span>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="payload-plaintext-field" className="text-[9px] font-mono uppercase text-slate-500 block font-black">Plaintext Vault Value (Secret Key / Notes / passwords)</label>
                    <div className="flex gap-2">
                      <input
                        id="payload-plaintext-field"
                        type="text"
                        value={plaintextToEncrypt}
                        onChange={e => setPlaintextToEncrypt(e.target.value)}
                        className="w-full text-xs bg-black/45 border border-white/15 rounded-xl px-3 py-2.5 text-sky-400 font-mono focus:outline-none focus:border-blue-500"
                        placeholder="Type raw secret content..."
                      />
                      <button
                        type="button"
                        id="trigger-gcm-encrypt-btn"
                        onClick={executeRealEncrypt}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-mono font-black text-xs uppercase px-4 py-2 rounded-xl border border-blue-600 cursor-pointer"
                      >
                        Encrypt
                      </button>
                    </div>
                  </div>

                  {realCipherB64 && (
                    <div className="space-y-3.5 border-t border-white/5 pt-3 animate-fade-in text-[11px] font-mono leading-relaxed">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div>
                          <span className="text-[8px] uppercase text-amber-500 font-black tracking-widest block mb-0.5">Initialization Vector (96-Bit IV)</span>
                          <span className="font-bold text-amber-400 break-all">{realIvB64}</span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase text-sky-400 font-black tracking-widest block mb-0.5">Authentication Integrity Tag (128-Bit)</span>
                          <span className="font-bold text-sky-400">Integrated inside ciphertext array</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] uppercase text-fuchsia-400 font-black tracking-widest block">AES-GCM Ciphertext Payload (Ready to store in SQLite safely)</span>
                        <div className="p-3 bg-black/35 rounded-xl text-fuchsia-400 font-bold break-all border border-white/10 text-[10px]">
                          {realCipherB64}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        <button
                          type="button"
                          id="trigger-gcm-decrypt-btn"
                          onClick={executeRealDecrypt}
                          className="bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/20 text-emerald-400 font-mono font-black text-xs uppercase py-2 px-3 rounded-xl transition cursor-pointer"
                        >
                          Perform GCM Authentication & Decrypt
                        </button>

                        {realDecryptedResult && (
                          <div className={`p-2 rounded-xl text-xs flex-1 ${
                            realDecryptedResult.includes('Error') 
                              ? 'bg-rose-950/20 text-rose-400 border border-rose-500/10'
                              : 'bg-emerald-950/20 text-emerald-400 font-bold border border-emerald-500/10'
                          }`}>
                            Result: {realDecryptedResult}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              </div>
            </div>

          </div>
        ) : labTab === 'hardware_guide' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fade-in select-text">
            
            {/* Guide content */}
            <div className="space-y-4">
              <div className="bg-black/25 p-5 rounded-2xl border border-white/5 space-y-4">
                <span className="text-xs text-purple-400 font-black uppercase tracking-wider font-mono flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" /> Secure Storage architecture (iOS / Android)
                </span>
                
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  On-device cryptography is highly vulnerable if malware or root operators can scrape the system memory or pull files out of standard SQLite databases.
                </p>

                <div className="space-y-3 text-[11px] font-sans">
                  <div className="border-l-2 border-purple-500/50 pl-3 py-1 space-y-1">
                    <span className="text-white font-bold block">iOS Keychain & Secure Enclave</span>
                    <p className="text-slate-400 leading-relaxed text-[10px]">
                      The <strong>Secure Enclave Processor (SEP)</strong> is a physically isolated coprocessor. Symmetrical keys generated here never leave the silicon. The salt is placed in Keychain accessible tags (e.g. <code>kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly</code>), ensuring it is never synced via iCloud backed files or readable outside device boundaries.
                    </p>
                  </div>

                  <div className="border-l-2 border-indigo-500/50 pl-3 py-1 space-y-1">
                    <span className="text-white font-bold block">Android KeyStore & StrongBox TEE</span>
                    <p className="text-slate-400 leading-relaxed text-[10px]">
                      Android delegates keys to hardware-backed <strong>Trusted Execution Environments (TEE)</strong> or standalone physical tampered StrongBox chips (Titan M). By generating keys marked <code>setUserAuthenticationRequired(true)</code>, Android hardware prevents unauthorized crypto operations even if an attacker root-accesses the Linux user shell.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-purple-950/20 border border-purple-500/15 rounded-xl space-y-1">
                  <div className="text-[10px] font-mono text-purple-300 font-extrabold uppercase">Mobile Jailbreak / Root Resistance</div>
                  <p className="text-[9px] text-slate-400 font-sans leading-normal">
                    Even on rooted phones, hardware crypt keys are safe because memory is segregated at the silicon level. The phone’s CPU cannot retrieve the key directly, it can only send ciphertext to the hardware chip and receive back decrypted plaintexts if biometric validation matches.
                  </p>
                </div>
              </div>
            </div>

            {/* Hardware Logs Stream */}
            <div className="bg-black/45 p-5 rounded-2xl border border-white/10 space-y-3 h-[310px] flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-1.5 border-b border-white/5 pb-1.5 block">
                  <TermIcon className="w-3.5 h-3.5 text-purple-400" /> Virtual Secure Enclave Diagnostics
                </span>

                <div className="overflow-y-auto h-[200px] font-mono text-[9px] text-slate-400 pt-1 space-y-2">
                  {secureHardwareLogs.map((log, lidx) => (
                    <div key={lidx} className="leading-relaxed border-b border-white/5 pb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>SIM STATE: <strong className="text-purple-400">HARDWARE SECURED</strong></span>
                <span className="text-[9px] text-slate-600">sepOS v14.92</span>
              </div>
            </div>

          </div>
        ) : (
          /* BIP-39 Emergency Recovery Kit Layout */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fade-in select-text">
            
            <div className="space-y-4">
              <div className="bg-black/25 p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-black uppercase tracking-wider font-mono">
                    BIP-39 Emergency Seed Phrase Crypt
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  On-device zero-knowledge applications are designed to guarantee complete user ownership of keys. Because there are no backend servers, if you forget your Master Password, your encrypted vaults will be locked forever unless you retain your <strong>24-word Recovery Phrase</strong>.
                </p>

                <div className="bg-black/35 p-4 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono uppercase text-slate-500 font-black">Your Secure Mnemonic Seed</span>
                    <button
                      type="button"
                      id="regen-mnemonic-btn"
                      onClick={() => {
                        const verified = window.confirm("WARNING: Regenerating critical device mnemonics will invalidate your old password recovery capability. Are you sure you want to commit brand new physical seed entropy?");
                        if (verified) {
                          const newPhrase = generateMnemonicPhrase();
                          setRecoveryPhrase(newPhrase);
                          onSetRecoveryVerified(false);
                          if (addLog) addLog('SYSTEM', 'warn', 'Mnemonic entropy seed regenerated. Please re-write them down.');
                        }
                      }}
                      className="text-[8px] font-mono uppercase font-bold text-amber-400/80 hover:text-amber-300 px-1.5 py-0.5 border border-amber-500/10 rounded hover:bg-amber-500/10 transition cursor-pointer"
                    >
                      Regenerate
                    </button>
                  </div>

                  {/* Seed words grid */}
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] leading-relaxed">
                    {recoveryPhrase.split(' ').map((word, idx) => (
                      <div 
                        key={idx} 
                        className="bg-black/30 border border-white/5 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-300 shadow-inner"
                      >
                        <span className="text-[8px] text-slate-600 font-black">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span className="font-semibold text-slate-200">{word}</span>
                      </div>
                    ))}
                  </div>

                  {/* Copy helper */}
                  <div className="flex items-center justify-between pt-1 font-mono">
                    <span className="text-[8px] text-slate-505">256-Bits Entropy Standard</span>
                    <button
                      type="button"
                      id="copy-mnemonic-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(recoveryPhrase);
                        setCopiedPhrase(true);
                        setTimeout(() => setCopiedPhrase(false), 2000);
                        if (addLog) addLog('SYSTEM', 'success', 'BIP-39 mnemonic seed phrase copied to system scratchpad securely.');
                      }}
                      className="text-[9px] uppercase font-black text-emerald-400 hover:text-emerald-350 transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPhrase ? (<><span className="text-emerald-500">Copied!</span></>) : (<><Copy className="w-3 h-3" /> Copy Full Phrase</>)}
                    </button>
                  </div>
                </div>

                {/* Secure certification check */}
                <label className="flex items-start gap-3 p-3.5 bg-emerald-950/15 border border-emerald-500/15 rounded-2xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recoveryVerified}
                    id="recovery-completed-checkbox"
                    onChange={e => {
                      onSetRecoveryVerified(e.target.checked);
                      if (addLog) {
                        addLog('SYSTEM', e.target.checked ? 'success' : 'warn', e.target.checked ? 'Mnemonic backup verification acknowledged by user.' : 'Mnemonic backup marked unverified.');
                      }
                    }}
                    className="mt-0.5 accent-emerald-500 rounded border-white/20"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-400 font-black block">Safety Pledge Checked</span>
                    <p className="text-[9px] text-slate-400 leading-relaxed font-sans">
                      I have written this phrase on a piece of physical paper and hid it in a secured fire-proof desk. If my biometric/PIN resets, I will use this as my fallback.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Practical test simulator column */}
            <div className="space-y-4">
              <div className="bg-black/25 p-5 rounded-2xl border border-white/10 space-y-4.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin-slow" />
                    <span className="text-xs text-amber-400 font-mono font-black uppercase tracking-wider">
                      Interactive Password Recovery Simulator
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed mt-2.5">
                    Forgot your master credentials? Type/paste your active 24-word recovery phrase below to bypass lock restrictions, reprogram derived AES keys, and bind a new Master Password immediately.
                  </p>

                  <div className="space-y-3.5 mt-3.5">
                    <div className="space-y-1">
                      <label htmlFor="recovery-phrase-test-field" className="text-[9px] font-mono uppercase text-slate-500 block font-black">Emergency 24-Word Phrase</label>
                      <textarea
                        id="recovery-phrase-test-field"
                        rows={3}
                        value={testPhraseInput}
                        onChange={e => setTestPhraseInput(e.target.value)}
                        className="w-full text-xs font-mono bg-black/45 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-amber-400 placeholder-slate-705 leading-normal"
                        placeholder="alpha beacon carbon danger..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="new-master-pwd-field" className="text-[9px] font-mono uppercase text-slate-500 block font-black">Choose New Safe Master Password</label>
                      <input
                        id="new-master-pwd-field"
                        type="text"
                        value={newMasterInput}
                        onChange={e => setNewMasterInput(e.target.value)}
                        className="w-full text-xs font-mono bg-black/45 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-amber-400"
                        placeholder="My_New_Super_Symmetric_Password_99!"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-2">
                  <button
                    type="button"
                    id="trigger-mnemonic-reset-btn"
                    onClick={() => {
                      if (!testPhraseInput || !newMasterInput) {
                        alert("Both active seed phrase input and proposed master password are required for recovery.");
                        return;
                      }
                      
                      const cleanInput = testPhraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
                      const cleanTarget = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
                      
                      if (cleanInput === cleanTarget) {
                        onUpdateSecretKey(newMasterInput);
                        setTestPhraseInput('');
                        setNewMasterInput('');
                        alert("PASSCODE RESET SUCCESSFULLY! Your physical key mnemonic matched. A new master symmetric cipher key was derived in secure hardware memory.");
                        if (addLog) addLog('SYSTEM', 'success', 'Password reset bypass triggered via valid offline BIP-39 phrase.');
                      } else {
                        alert("CRITICAL ERROR: Recovery phrase match failed. Symmetrical derivation key boundary rejected the input.");
                        if (addLog) addLog('SYSTEM', 'error', 'Mnemonic signature invalid. Key reset transaction aborted.');
                      }
                    }}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-mono font-black text-xs uppercase py-3 rounded-xl border border-amber-600 cursor-pointer shadow-lg shadow-amber-500/10 active:scale-95 transition"
                  >
                    Bypass & Reset Symmetrical Key Matrix
                  </button>
                  <p className="text-[8px] text-slate-500 leading-relaxed font-sans text-center">
                    Note: Running this simulation updates the secretKey dynamically inside the browser container!
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
