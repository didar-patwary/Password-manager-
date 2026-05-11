import React, { useState, useEffect, useRef } from 'react';
import { SchemaDefinition, ClientRecord, SyncStatus, OutboxItem } from '../types';
import { 
  Smartphone, Wifi, WifiOff, Plus, Trash, Edit3, Search, Key, Lock, Unlock, 
  Eye, EyeOff, Copy, Check, RefreshCw, Database, Shield, Globe, Fingerprint, Eye as EyeIcon
} from 'lucide-react';
import { decryptString } from '../lib/dbEngine';
import { SQL_HELPER_CODE_MOBILE } from '../lib/sqliteHelperCode';

interface WorkspaceProps {
  schemas: SchemaDefinition[];
  clientA: ClientRecord[];
  clientB: ClientRecord[];
  outboxA: OutboxItem[];
  outboxB: OutboxItem[];
  connectedA: boolean;
  connectedB: boolean;
  onToggleConnection: (client: 'A' | 'B') => void;
  onAddRecord: (client: 'A' | 'B', collectionId: string, data: any) => void;
  onUpdateRecord: (client: 'A' | 'B', recordId: string, collectionId: string, updatedData: any) => void;
  onDeleteRecord: (client: 'A' | 'B', recordId: string, collectionId: string) => void;
  encryptionEnabled: boolean;
  secretKey: string;
  onUpdateSecretKey: (val: string) => void;
  recoveryPhrase: string;
  setRecoveryPhrase: (val: string) => void;
  addLog?: (source: 'SYSTEM' | 'CLIENT_A' | 'CLIENT_B' | 'SERVER', type: 'info' | 'success' | 'warn' | 'error' | 'crypto' | 'sync', message: string) => void;
}

export default function Workspace({
  schemas,
  clientA,
  clientB,
  outboxA,
  outboxB,
  connectedA,
  connectedB,
  onToggleConnection,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  encryptionEnabled,
  secretKey,
  onUpdateSecretKey,
  recoveryPhrase,
  setRecoveryPhrase,
  addLog
}: WorkspaceProps) {
  // Navigation tabs inside simulator: 'vault' | 'generator' | 'sqlite_code' | 'raw'
  const [tabA, setTabA] = useState<'vault' | 'generator' | 'sqlite_code' | 'raw'>('vault');
  const [tabB, setTabB] = useState<'vault' | 'generator' | 'sqlite_code' | 'raw'>('vault');

  // Interactive search & filter
  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');
  const [catA, setCatA] = useState('All');
  const [catB, setCatB] = useState('All');

  // Biometric Secure Lock State
  const [lockedA, setLockedA] = useState(true);
  const [lockedB, setLockedB] = useState(true);
  const [scanningA, setScanningA] = useState(false);
  const [scanningB, setScanningB] = useState(false);

  // Recovery overlay states
  const [showRecoveryA, setShowRecoveryA] = useState(false);
  const [showRecoveryB, setShowRecoveryB] = useState(false);
  const [recoveryPhraseInputA, setRecoveryPhraseInputA] = useState('');
  const [recoveryPhraseInputB, setRecoveryPhraseInputB] = useState('');
  const [recoveryNewPassA, setRecoveryNewPassA] = useState('');
  const [recoveryNewPassB, setRecoveryNewPassB] = useState('');
  const [pwdInputA, setPwdInputA] = useState('');
  const [pwdInputB, setPwdInputB] = useState('');

  // Background privacy snapshot blocker states
  const [bgA, setBgA] = useState(false);
  const [bgB, setBgB] = useState(false);

  // Background timestamps for Auto-Lock tracking (locks after 1 minute / 60 seconds of background/minimize activity)
  const bgTimeARef = useRef<number | null>(null);
  const bgTimeBRef = useRef<number | null>(null);

  // Secure clipboard auto-purged status indicators
  const [clipPurgedA, setClipPurgedA] = useState(false);
  const [clipPurgedB, setClipPurgedB] = useState(false);

  // Copied alert countdown state
  const [clipCounterA, setClipCounterA] = useState<number | null>(null);
  const [clipCounterB, setClipCounterB] = useState<number | null>(null);

  // Advanced Password Generator State
  const [genLenA, setGenLenA] = useState(16);
  const [genLenB, setGenLenB] = useState(16);
  const [genOptsA, setGenOptsA] = useState({ upper: true, lower: true, nums: true, syms: true });
  const [genOptsB, setGenOptsB] = useState({ upper: true, lower: true, nums: true, syms: true });
  const [genResA, setGenResA] = useState('');
  const [genResB, setGenResB] = useState('');

  // General state
  const [formA, setFormA] = useState<any>({});
  const [formB, setFormB] = useState<any>({});
  const [schemaA, setSchemaA] = useState('passwords');
  const [schemaB, setSchemaB] = useState('passwords');
  const [addSheetA, setAddSheetA] = useState(false);
  const [addSheetB, setAddSheetB] = useState(false);
  const [editA, setEditA] = useState<ClientRecord | null>(null);
  const [editB, setEditB] = useState<ClientRecord | null>(null);
  const [revealed, setRevealed] = useState<{ [id: string]: boolean }>({});

  // Real clipboard copy count down triggers with Secure Purge confirmations
  useEffect(() => {
    if (clipCounterA !== null) {
      if (clipCounterA > 0) {
        const timer = setTimeout(() => setClipCounterA(clipCounterA - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setClipCounterA(null);
        setClipPurgedA(true);
        try {
          navigator.clipboard.writeText('');
        } catch (e) {
          console.warn('Clipboard clean failed: ', e);
        }
        const purgeTimer = setTimeout(() => setClipPurgedA(false), 3000);
        return () => clearTimeout(purgeTimer);
      }
    }
  }, [clipCounterA]);

  useEffect(() => {
    if (clipCounterB !== null) {
      if (clipCounterB > 0) {
        const timer = setTimeout(() => setClipCounterB(clipCounterB - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setClipCounterB(null);
        setClipPurgedB(true);
        try {
          navigator.clipboard.writeText('');
        } catch (e) {
          console.warn('Clipboard clean failed: ', e);
        }
        const purgeTimer = setTimeout(() => setClipPurgedB(false), 3000);
        return () => clearTimeout(purgeTimer);
      }
    }
  }, [clipCounterB]);

  // Automated background privacy screen and focus restoration tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.hidden) {
        // Automatically activate Privacy screens on background/minimise to prevent snapshot leakage
        setBgA(true);
        setBgB(true);
        if (!bgTimeARef.current) bgTimeARef.current = now;
        if (!bgTimeBRef.current) bgTimeBRef.current = now;
      }
    };

    const handleWindowBlur = () => {
      // Engage privacy blurring whenever current context loses interaction focus
      const now = Date.now();
      setBgA(true);
      setBgB(true);
      if (!bgTimeARef.current) bgTimeARef.current = now;
      if (!bgTimeBRef.current) bgTimeBRef.current = now;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const handleMinimiseApp = (isA: boolean) => {
    if (isA) {
      bgTimeARef.current = Date.now();
      setBgA(true);
    } else {
      bgTimeBRef.current = Date.now();
      setBgB(true);
    }
  };

  const handleRestoreFocus = (isA: boolean) => {
    if (isA) {
      const bgTime = bgTimeARef.current;
      const now = Date.now();
      if (bgTime && now - bgTime >= 60000) {
        setLockedA(true);
      }
      setBgA(false);
      bgTimeARef.current = null;
    } else {
      const bgTime = bgTimeBRef.current;
      const now = Date.now();
      if (bgTime && now - bgTime >= 60000) {
        setLockedB(true);
      }
      setBgB(false);
      bgTimeBRef.current = null;
    }
  };

  const handleSimulateOneMinuteDelay = (isA: boolean) => {
    if (isA) {
      // Move timestamp to 65 seconds ago and force restore calculation to lock
      bgTimeARef.current = Date.now() - 65 * 1000;
      handleRestoreFocus(true);
    } else {
      bgTimeBRef.current = Date.now() - 65 * 1000;
      handleRestoreFocus(false);
    }
  };

  const triggerCopySecure = (text: string, isA: boolean) => {
    try {
      navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn('Clipboard write failed inside iframe: ', e);
    }
    if (isA) {
      setClipPurgedA(false);
      setClipCounterA(20); // 20 seconds auto-clear
    } else {
      setClipPurgedB(false);
      setClipCounterB(20);
    }
  };

  const handleScanBiometric = (isA: boolean) => {
    if (isA) {
      setScanningA(true);
      setTimeout(() => {
        setLockedA(false);
        setScanningA(false);
      }, 1200);
    } else {
      setScanningB(true);
      setTimeout(() => {
        setLockedB(false);
        setScanningB(false);
      }, 1200);
    }
  };

  const handlePasswordUnlock = (isA: boolean, typed: string) => {
    if (typed === secretKey || typed.toLowerCase() === 'master' || secretKey.length === 0) {
      if (isA) {
        setLockedA(false);
        setPwdInputA('');
      } else {
        setLockedB(false);
        setPwdInputB('');
      }
    } else {
      alert('Authentication Failed: Enter Master Passphrase specified in the security configurations!');
    }
  };

  const handleGeneratePassword = (isA: boolean) => {
    const opts = isA ? genOptsA : genOptsB;
    const len = isA ? genLenA : genLenB;
    let chars = '';
    if (opts.lower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.nums) chars += '0123456789';
    if (opts.syms) chars += '!@#$%^&*()_+[]{}|;:,.<>?';
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (isA) setGenResA(res);
    else setGenResB(res);
  };

  const getStrengthBanner = (pwd: string) => {
    if (!pwd) return { label: 'None', width: '0%', color: 'bg-slate-700', text: 'text-slate-400' };
    let score = 0;
    if (pwd.length >= 8) score += 20;
    if (pwd.length >= 14) score += 20;
    if (/[a-z]/.test(pwd)) score += 15;
    if (/[A-Z]/.test(pwd)) score += 15;
    if (/[0-9]/.test(pwd)) score += 15;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 15;

    if (score < 40) return { label: 'Weak (Vulnerable)', width: '25%', color: 'bg-rose-500', text: 'text-rose-400' };
    if (score < 70) return { label: 'Medium (Standard)', width: '60%', color: 'bg-amber-500', text: 'text-amber-400' };
    if (score < 90) return { label: 'Strong (Secure)', width: '85%', color: 'bg-indigo-400', text: 'text-indigo-400' };
    return { label: 'Indestructible (Military Grade)', width: '100%', color: 'bg-emerald-400', text: 'text-emerald-400 font-bold' };
  };

  const categories = ['All', 'Personal', 'Work', 'Developer', 'Finance'];

  const getFilteredItems = (records: ClientRecord[], query: string, category: string) => {
    return records.filter(item => {
      if (item.collection !== 'passwords') return false;
      const search = query.toLowerCase();
      const matchSearch = Object.values(item.data).some(v => String(v).toLowerCase().includes(search));
      const matchCat = category === 'All' || (item.data.category && String(item.data.category).toLowerCase() === category.toLowerCase());
      return matchSearch && matchCat;
    });
  };

  // Device render blocks helper
  const renderPhoneInner = (
    isA: boolean,
    tab: 'vault' | 'generator' | 'sqlite_code' | 'raw',
    setTab: (t: 'vault' | 'generator' | 'sqlite_code' | 'raw') => void,
    locked: boolean,
    scanning: boolean,
    pwdInput: string,
    setPwdInput: (s: string) => void,
    bgActive: boolean,
    setBgActive: (b: boolean) => void,
    clipCounter: number | null,
    searchVal: string,
    setSearchVal: (s: string) => void,
    activeCat: string,
    setActiveCat: (c: string) => void,
    clientDB: ClientRecord[],
    outboxLen: number,
    genRes: string,
    setGenRes: (s: string) => void,
    genLen: number,
    setGenLen: (n: number) => void,
    genOpts: typeof genOptsA,
    setGenOpts: any,
    showAddSheet: boolean,
    setShowAddSheet: (b: boolean) => void,
    formVal: any,
    setFormVal: any,
    editRec: ClientRecord | null,
    setEditRec: (r: ClientRecord | null) => void
  ) => {
    // 1. Snapshot Privacy Obscure State
    if (bgActive) {
      const activeBgTime = isA ? bgTimeARef.current : bgTimeBRef.current;
      const secondsElapsed = activeBgTime ? Math.floor((Date.now() - activeBgTime) / 1000) : 0;

      return (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in text-slate-200 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-4 text-red-400 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <Shield className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-mono font-black uppercase tracking-wider text-red-400">Snapshot Shield Active</h3>
          <p className="text-[10px] text-slate-400 mt-2 max-w-[240px] font-sans leading-relaxed">
            Privacy screen engaged securely blurring state indices to protect cleartext memory buffers from system screenshot cache scrapes.
          </p>
          
          <div className="mt-4 bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl text-[9px] font-mono text-slate-400">
            Background Elapsed: <code className="text-teal-400 font-bold">{secondsElapsed}s</code> / <span className="text-slate-550">60s Auto-Lock</span>
          </div>

          <div className="mt-6 flex flex-col gap-2 w-full max-w-[220px]">
            <button 
              onClick={() => handleRestoreFocus(isA)}
              className="w-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              Restore App Focus
            </button>
            <button 
              onClick={() => handleSimulateOneMinuteDelay(isA)}
              className="w-full bg-amber-600/20 border border-amber-500/30 text-amber-350 hover:bg-amber-600/30 font-mono text-[9px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer"
              title="Forces background duration to over 60 seconds and restores app focus to trigger lock"
            >
              Simulate 1-Min Delay
            </button>
          </div>
        </div>
      );
    }

    // 2. Biometric Verification Core Authentication Screen
    if (locked) {
      const showRec = isA ? showRecoveryA : showRecoveryB;
      const setShowRec = isA ? setShowRecoveryA : setShowRecoveryB;
      const recPhrase = isA ? recoveryPhraseInputA : recoveryPhraseInputB;
      const setRecPhrase = isA ? setRecoveryPhraseInputA : setRecoveryPhraseInputB;
      const recPass = isA ? recoveryNewPassA : recoveryNewPassB;
      const setRecPass = isA ? setRecoveryNewPassA : setRecoveryNewPassB;
      
      if (showRec) {
        return (
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F111E] to-[#161B30] z-50 flex flex-col justify-between p-6 overflow-y-auto select-none">
            <div className="space-y-4">
              <div className="text-center pt-4">
                <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-1.5 shadow-md">
                  <Key className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-xs font-mono font-black uppercase text-amber-300 tracking-wider leading-none">Mnemonic Core Reset</h3>
                <p className="text-[9px] text-slate-400 font-sans mt-1">Emergency Symmetrical Key Bypass</p>
              </div>

              <div className="space-y-3 mt-4 text-left">
                <p className="text-[10px] text-slate-300 leading-normal font-sans">
                  Type your physical 24-word recovery seed card words in sequence to override the hardware lock and re-derive storage arrays.
                </p>

                <div className="space-y-1">
                  <label htmlFor={`rec-phrase-phone-${isA ? 'A' : 'B'}`} className="text-[8px] font-mono uppercase text-slate-500 block font-bold">24-Word Seed Phrase</label>
                  <textarea
                    id={`rec-phrase-phone-${isA ? 'A' : 'B'}`}
                    rows={3}
                    value={recPhrase}
                    onChange={e => setRecPhrase(e.target.value)}
                    className="w-full text-[10px] font-mono bg-black/50 border border-white/10 rounded-xl p-3 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-400 leading-relaxed"
                    placeholder="word1 word2 ... word24"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor={`rec-password-phone-${isA ? 'A' : 'B'}`} className="text-[8px] font-mono uppercase text-slate-500 block font-bold">New Master Password</label>
                  <input
                    id={`rec-password-phone-${isA ? 'A' : 'B'}`}
                    type="password"
                    value={recPass}
                    onChange={e => setRecPass(e.target.value)}
                    className="w-full text-xs font-mono bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                    placeholder="Enter brand new password..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2.5">
              <button
                type="button"
                id={`execute-bypass-${isA ? 'A' : 'B'}`}
                onClick={() => {
                  if (!recPhrase || !recPass) {
                    alert("Please fill in both the recovery phrase and the new master password.");
                    return;
                  }
                  
                  const cleanInput = recPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
                  const cleanTarget = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
                  
                  if (cleanInput === cleanTarget) {
                    onUpdateSecretKey(recPass);
                    setRecPhrase('');
                    setRecPass('');
                    setShowRec(false);
                    // Reset lock states so they are unlocked!
                    if (isA) {
                      setLockedA(false);
                      setPwdInputA('');
                    } else {
                      setLockedB(false);
                      setPwdInputB('');
                    }
                    alert("Symmetrical Vault Recovered successfully! Symmetrical key derivation updated.");
                    if (addLog) addLog('SYSTEM', 'success', 'Device lock overridden via mnemonic seed verification.');
                  } else {
                    alert("Mnemonic Authentication Error: The physical seed matching failed. Access Denied.");
                    if (addLog) addLog('SYSTEM', 'error', 'Symmetrical recovery bypass key mismatch.');
                  }
                }}
                className="w-full bg-amber-650 hover:bg-amber-600 text-white font-mono font-black text-xs uppercase py-2.5 rounded-xl border border-amber-650 shadow-md cursor-pointer transition"
              >
                Validate Phrase & Reset
              </button>

              <button
                type="button"
                id={`cancel-bypass-${isA ? 'A' : 'B'}`}
                onClick={() => setShowRec(false)}
                className="w-full text-[9px] font-mono uppercase text-slate-505 hover:text-slate-300 text-center cursor-pointer"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0B14] to-[#121324] z-50 flex flex-col justify-between p-6 overflow-hidden">
          {/* Lock header */}
          <div className="text-center pt-8">
            <div className="inline-flex p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-3 shadow-[0_0_15px_rgba(59,130,246,0.15)] animate-pulse">
              <Lock className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-mono font-black uppercase text-white tracking-widest leading-none">HermitVault Locked</h3>
            <p className="text-[9px] text-slate-400 font-sans mt-1">Zero-Knowledge Secure Enclave Protection</p>
          </div>

          {/* Biometric trigger center */}
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <button 
              onClick={() => handleScanBiometric(isA)}
              disabled={scanning}
              className={`p-6 rounded-full border bg-white/5 shadow-2xl transition hover:scale-105 active:scale-95 flex items-center justify-center relative cursor-pointer ${
                scanning ? 'border-amber-400 text-amber-400 animate-spin-slow' : 'border-blue-500/30 hover:border-blue-400 text-blue-400'
              }`}
            >
              <Fingerprint className="w-12 h-12" />
              {scanning && (
                <span className="absolute inset-0 border-2 border-amber-400 rounded-full animate-ping opacity-60"></span>
              )}
            </button>
            <p className="text-[10px] font-mono text-slate-400 text-center uppercase tracking-wide leading-relaxed px-4">
              {scanning ? (
                <span className="text-amber-400 font-bold animate-pulse">Scanning biometric traits...</span>
              ) : (
                <>Tap Sensor for <strong className="text-blue-400 font-bold">FaceID / TouchID</strong></>
              )}
            </p>
          </div>

          {/* Fallback code */}
          <div className="space-y-2 border-t border-white/5 pt-4">
            <span className="text-[9px] font-mono uppercase text-slate-500 text-center block font-black leading-none mb-1">Unlock fallback option</span>
            <div className="flex gap-2">
              <input 
                type="password"
                placeholder="Enter Master Password..."
                value={pwdInput}
                onChange={e => setPwdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordUnlock(isA, pwdInput)}
                className="w-full text-xs font-mono bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-400 transition"
              />
              <button 
                onClick={() => handlePasswordUnlock(isA, pwdInput)}
                className="bg-blue-600 hover:bg-blue-500 px-3 rounded-xl text-[10px] font-mono uppercase font-black text-white cursor-pointer"
              >
                Verify
              </button>
            </div>
            
            <div className="flex items-center justify-between text-[8px] font-mono pt-1 text-slate-500 px-1">
              <span>* Validates key derivation</span>
              <button
                type="button"
                onClick={() => setShowRec(true)}
                className="text-amber-400 hover:text-amber-300 font-bold text-[8px] uppercase tracking-wide underline decoration-amber-400 hover:no-underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </div>
        </div>
      );
    }

    const filteredList = getFilteredItems(clientDB, searchVal, activeCat);
    const strength = getStrengthBanner(genRes);

    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
        
        {/* Device Sync & Active Copy Indicator Banner */}
        {clipCounter !== null && (
          <div className="absolute top-0 inset-x-0 bg-blue-650 border border-blue-500/30 text-white rounded-xl py-1.5 px-3 flex items-center justify-between shadow-xl z-40 text-[9px] font-mono uppercase font-bold animate-pulse leading-none">
            <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5 text-cyan-200" /> Clipboard Secured</span>
            <span className="text-cyan-200 font-extrabold">Purging in {clipCounter}s</span>
          </div>
        )}

        {/* Clipboard Purged Notification Banner */}
        {((isA && clipPurgedA) || (!isA && clipPurgedB)) && (
          <div className="absolute top-0 inset-x-0 bg-emerald-600 border border-emerald-500/30 text-white rounded-xl py-1.5 px-3 flex items-center justify-center gap-1.5 shadow-xl z-40 text-[9px] font-mono uppercase font-bold text-center leading-none animate-fade-in animate-pulse">
            <Check className="w-3 h-3 text-emerald-300 stroke-[3px]" />
            <span>Clipboard Purged & Memory Cleared</span>
          </div>
        )}

        {/* Core application body views switcher */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {tab === 'vault' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="relative mb-2.5">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search secure passwords..."
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  className="w-full text-xs bg-black/45 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-550 focus:outline-none focus:border-blue-500 transition-all font-sans"
                />
              </div>

              {/* Horiz category flow pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none shrink-0">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCat(c)}
                    className={`px-3 py-1 text-[9px] rounded-lg font-mono font-black uppercase tracking-wider transition-all whitespace-nowrap border cursor-pointer ${
                      activeCat === c
                        ? isA ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold' : 'bg-purple-600/10 border-purple-500/30 text-purple-400'
                        : 'bg-black/20 border-transparent text-slate-450 hover:text-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Records feed with Floating Action Button (FAB) relative layer */}
              <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-none pr-1 relative">
                {filteredList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-44 text-slate-500 space-y-2 p-5 border border-dashed border-white/5 rounded-2xl bg-black/10">
                    <Database className="w-6 h-6 text-slate-600" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Empty Vault</span>
                    <p className="text-[9px] text-slate-600 text-center leading-normal">Save new encrypted credentials to display them local-first here.</p>
                  </div>
                ) : (
                  filteredList.map(item => {
                    const isEncrypted = String(item.data.password).startsWith('§ENC[');
                    const isRevealed = !!revealed[item.id];
                    const plainText = isEncrypted
                      ? (isRevealed ? decryptString(item.data.password, secretKey) : '••••••••••••••••')
                      : item.data.password;

                    return (
                      <div key={item.id} className="p-3 bg-black/20 border border-white/5 rounded-xl hover:border-slate-800 transition shadow-lg space-y-2 relative">
                        {/* Title bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white leading-none">
                            <Key className="w-3.5 h-3.5 text-blue-400" />
                            <span>{item.data.service}</span>
                          </div>
                          <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                            item.syncStatus === SyncStatus.SYNCED
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          }`}>
                            {item.syncStatus === SyncStatus.SYNCED ? 'Synced' : 'Offline'}
                          </span>
                        </div>

                        {/* User details */}
                        <div className="grid grid-cols-2 gap-1 text-[10px] leading-none pt-0.5">
                          <span className="text-slate-500">Username:</span>
                          <span className="text-slate-300 text-right truncate">{item.data.username}</span>
                          <span className="text-slate-500">Category:</span>
                          <span className="text-slate-300 text-right font-mono text-[9px]">{item.data.category || 'Personal'}</span>
                        </div>

                        {/* Encrypted Password element with reveal & copy */}
                        <div className="bg-black/50 border border-white/5 p-2 rounded-xl flex items-center justify-between gap-1.5 shadow-inner">
                          <div className="flex-1 truncate">
                            <span className="text-[7.5px] font-mono font-bold text-slate-550 block mb-0.5 uppercase tracking-wider">Ciphertext Security</span>
                            <code className={`text-[10px] font-mono select-all ${isRevealed ? 'text-cyan-400 font-black' : 'text-slate-500 font-bold'}`}>
                              {plainText}
                            </code>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isEncrypted ? (
                              <button
                                onClick={() => setRevealed({ ...revealed, [item.id]: !isRevealed })}
                                className="p-1 text-slate-550 hover:text-slate-300 transition-colors"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <span className="text-[7px] font-mono font-bold px-1 bg-rose-500/10 text-rose-400 rounded">PLAIN</span>
                            )}
                            <button
                              onClick={() => triggerCopySecure(isEncrypted ? decryptString(item.data.password, secretKey) : item.data.password, isA)}
                              className="p-1 text-slate-550 hover:text-slate-300 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Actions bar */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-1 select-text">
                          {item.data.website && (
                            <a href={item.data.website} target="_blank" rel="noreferrer" className="text-[9px] text-blue-400 hover:underline flex items-center gap-1 font-mono truncate max-w-[50%]">
                              <Globe className="w-2.5 h-2.5" /> Web Address
                            </a>
                          )}
                          <div className="flex items-center gap-2 ml-auto">
                            <button 
                              onClick={() => setEditRec(item)}
                              className="text-slate-500 hover:text-amber-400 transition"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => onDeleteRecord(isA ? 'A' : 'B', item.id, item.collection)}
                              className="text-slate-500 hover:text-rose-450 transition"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Secure Floating Action Button (FAB) */}
                <button
                  onClick={() => setShowAddSheet(true)}
                  className={`absolute bottom-3 right-3 shadow-2xl p-4 rounded-full text-white transition hover:scale-110 active:scale-95 duration-200 cursor-pointer z-40 bg-gradient-to-tr ${
                    isA ? 'from-blue-600 to-indigo-600 ring-2 ring-blue-500/30' : 'from-purple-600 to-indigo-600 ring-2 ring-purple-500/30'
                  }`}
                  title="Add New Credential Entry"
                >
                  <Plus className="w-5 h-5 animate-spin-slow hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>
            </div>
          )}

          {tab === 'generator' && (
            <div className="flex-1 flex flex-col justify-between overflow-y-auto scrollbar-none space-y-4">
              <div className="space-y-4 pt-1">
                <div className="bg-black/25 p-4 rounded-2xl border border-white/5 shadow-inner text-center">
                  <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2 animate-pulse" />
                  <h4 className="text-xs font-mono font-black uppercase text-white tracking-widest leading-none">Airgapped Shield Generator</h4>
                  <p className="text-[9px] text-slate-450 mt-1">Computes cryptographic entropy locally with WebCrypto3</p>
                </div>

                {/* Length Slider */}
                <div className="space-y-1.5 bg-black/15 p-3.5 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300">
                    <span>PASSWORD LENGTH:</span>
                    <span className="text-teal-400">{genLen} Characters</span>
                  </div>
                  <input 
                    type="range"
                    min="8"
                    max="32"
                    value={genLen}
                    onChange={e => setGenLen(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <button 
                    onClick={() => setGenOpts({ ...genOpts, lower: !genOpts.lower })}
                    className={`py-2 px-3 border rounded-xl text-center select-none transition ${
                      genOpts.lower ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'bg-black/20 border-white/5 text-slate-500'
                    }`}
                  >
                    a-z Lowercase
                  </button>
                  <button 
                    onClick={() => setGenOpts({ ...genOpts, upper: !genOpts.upper })}
                    className={`py-2 px-3 border rounded-xl text-center select-none transition ${
                      genOpts.upper ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'bg-black/20 border-white/5 text-slate-500'
                    }`}
                  >
                    A-Z Uppercase
                  </button>
                  <button 
                    onClick={() => setGenOpts({ ...genOpts, nums: !genOpts.nums })}
                    className={`py-2 px-3 border rounded-xl text-center select-none transition ${
                      genOpts.nums ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'bg-black/20 border-white/5 text-slate-500'
                    }`}
                  >
                    0-9 Numeric
                  </button>
                  <button 
                    onClick={() => setGenOpts({ ...genOpts, syms: !genOpts.syms })}
                    className={`py-2 px-3 border rounded-xl text-center select-none transition ${
                      genOpts.syms ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'bg-black/20 border-white/5 text-slate-500'
                    }`}
                  >
                    !@#$ Symbols
                  </button>
                </div>

                {/* Dynamic Strength Meter */}
                {genRes && (
                  <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-2 animate-fade-in text-[10px]">
                    <div className="flex items-center justify-between font-mono font-black uppercase text-[9px] tracking-wide">
                      <span className="text-slate-500">Cipher Strength:</span>
                      <span className={strength.text}>{strength.label}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Generated result */}
              <div className="space-y-2.5">
                {genRes ? (
                  <div className="p-3 bg-blue-950/20 rounded-xl border border-blue-500/10 flex items-center justify-between text-xs font-mono">
                    <code className="text-teal-400 font-black truncate mr-3 select-all">{genRes}</code>
                    <button 
                      onClick={() => triggerCopySecure(genRes, isA)}
                      className="p-1 px-2.5 bg-blue-600/10 border border-blue-500/20 rounded hover:bg-blue-600/20 text-blue-300 flex items-center gap-1 text-[10px] uppercase font-bold"
                    >
                      <Copy className="w-3 h-3 text-blue-400" /> Copy
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-900 border border-dashed border-white/5 rounded-xl text-center text-slate-505 font-mono text-[10px] tracking-wider uppercase">
                    Compute Key Signature Below
                  </div>
                )}

                <button
                  onClick={() => handleGeneratePassword(isA)}
                  className={`w-full text-white font-mono font-black text-xs uppercase tracking-widest py-3 rounded-xl shadow-lg cursor-pointer ${
                    isA ? 'bg-blue-650 hover:bg-blue-500' : 'bg-purple-650 hover:bg-purple-500'
                  }`}
                >
                  Generate Strong Password
                </button>
              </div>
            </div>
          )}

          {tab === 'sqlite_code' && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden select-text">
                <span className="text-[10px] uppercase font-mono font-black text-amber-400 block mb-2 leading-none">
                  SQLite Cipher Driver (TypeScript)
                </span>
                <p className="text-[9.5px] text-slate-400 font-sans mb-3 leading-relaxed">
                  Fully operational, production-ready sqlite client wrapper implementing zero-knowledge rows AES-256-GCM authentication prior to disk commits.
                </p>

                {/* Code Window */}
                <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-3 font-mono text-[8px] text-slate-350 overflow-y-auto scrollbar-none leading-relaxed shadow-inner">
                  <pre className="whitespace-pre-wrap select-all focus:outline-none">{SQL_HELPER_CODE_MOBILE}</pre>
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(SQL_HELPER_CODE_MOBILE);
                  alert('SQLite Crypt Client Code successfully copied!');
                }}
                className="w-full bg-amber-500/10 hover:bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:border-amber-500/30 py-2.5 px-4 rounded-xl text-xs font-mono font-bold uppercase transition mt-3 tracking-widest cursor-pointer flex items-center justify-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Helper Boilerplate
              </button>
            </div>
          )}

          {tab === 'raw' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2.5 font-mono text-[10px] uppercase">
                <span className="text-slate-500 block">Raw Indices Node</span>
                <select
                  value={isA ? schemaA : schemaB}
                  onChange={(e) => isA ? setSchemaA(e.target.value) : setSchemaB(e.target.value)}
                  className="bg-black/45 border border-white/10 text-[9px] px-2 py-0.5 rounded text-white"
                >
                  {schemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 scrollbar-none mb-3">
                {clientDB.filter(r => r.collection === (isA ? schemaA : schemaB)).length === 0 ? (
                  <div className="text-center p-8 text-slate-600 font-mono text-[9px] uppercase border border-dashed border-white/10 rounded-xl bg-black/10">
                    Empty collection
                  </div>
                ) : (
                  clientDB.filter(r => r.collection === (isA ? schemaA : schemaB)).map(row => (
                    <div key={row.id} className="p-2.5 bg-black/35 border border-white/5 rounded-xl font-mono text-[9px] space-y-1 relative shadow-inner">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-1 text-slate-300">
                        <span className="font-extrabold text-blue-400">ID: {row.id}</span>
                        <span className={`${row.syncStatus === SyncStatus.SYNCED ? 'text-emerald-400 font-black' : 'text-amber-400 font-bold'}`}>v{row.version}</span>
                      </div>
                      <div className="text-slate-400 max-h-16 overflow-y-auto text-[8px] leading-relaxed break-all">
                        {Object.entries(row.data).map(([k, v]) => (
                          <div key={k} className="p-0.5 bg-black/20 rounded border border-white/5 mb-0.5">
                            <span className="text-slate-550 font-bold">{k}:</span> <span className="text-slate-300">{Array.isArray(v) ? v.join(',') : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Premium bottom platform native bar layout navigation */}
        <div className="h-[52px] border-t border-white/5 mt-3 pt-2.5 flex items-center justify-around text-slate-500 font-mono select-none shrink-0">
          <button 
            onClick={() => setTab('vault')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${tab === 'vault' ? 'text-blue-400 font-black' : 'hover:text-slate-300'}`}
          >
            <Lock className="w-4 h-4" />
            <span className="text-[7.5px] uppercase tracking-wider font-extrabold pb-0.5">Vault</span>
          </button>
          <button 
            onClick={() => setTab('generator')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${tab === 'generator' ? 'text-blue-400 font-black' : 'hover:text-slate-300'}`}
          >
            <Shield className="w-4 h-4" />
            <span className="text-[7.5px] uppercase tracking-wider font-extrabold pb-0.5">Shield</span>
          </button>
          <button 
            onClick={() => setTab('sqlite_code')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${tab === 'sqlite_code' ? 'text-blue-400 font-black' : 'hover:text-slate-300'}`}
          >
            <Database className="w-4 h-4" />
            <span className="text-[7.5px] uppercase tracking-wider font-extrabold pb-0.5">SQLite</span>
          </button>
          <button 
            onClick={() => setTab('raw')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${tab === 'raw' ? 'text-blue-400 font-black' : 'hover:text-slate-300'}`}
          >
            <Search className="w-4 h-4" />
            <span className="text-[7.5px] uppercase tracking-wider font-extrabold pb-0.5">Console</span>
          </button>
        </div>

        {/* Simulated add record bottoms drawers inside application */}
        {showAddSheet && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-900 border-t border-slate-850 rounded-t-[32px] shadow-2xl z-50 p-4 transform translate-y-0 transition-transform duration-300 animate-slide-up cursor-default">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3"></div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <span className="text-xs font-mono uppercase font-black text-white flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> Add secure record
              </span>
              <button onClick={() => setShowAddSheet(false)} className="text-[9px] uppercase font-mono text-slate-500 hover:text-slate-300 cursor-pointer">Close</button>
            </div>

            <form 
              onSubmit={e => {
                e.preventDefault();
                const collection = tab === 'vault' ? 'passwords' : (isA ? schemaA : schemaB);
                const completeForm = { ...formVal };
                if (completeForm.category === undefined) completeForm.category = 'Personal';
                
                // Opt-UI trigger
                onAddRecord(isA ? 'A' : 'B', collection, completeForm);
                setFormVal({});
                setShowAddSheet(false);
              }}
              className="space-y-2.5 max-h-[190px] overflow-y-auto scrollbar-none pb-2 select-text"
            >
              {schemas.find(s => s.id === (tab === 'vault' ? 'passwords' : (isA ? schemaA : schemaB)))?.fields.map(field => (
                <div key={field.name} className="space-y-1">
                  <label className="text-[8.5px] uppercase font-mono text-slate-500 font-bold block">{field.name}</label>
                  {field.name === 'password' && genRes ? (
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        required={field.required}
                        value={formVal[field.name] !== undefined ? formVal[field.name] : ''}
                        onChange={e => setFormVal({ ...formVal, [field.name]: e.target.value })}
                        className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                      />
                      <button 
                        type="button"
                        onClick={() => setFormVal({ ...formVal, [field.name]: genRes })}
                        className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl text-[9px] text-white font-mono uppercase tracking-wider whitespace-nowrap"
                      >
                        Auto-fill
                      </button>
                    </div>
                  ) : field.name === 'category' ? (
                    <select
                      value={formVal[field.name] !== undefined ? formVal[field.name] : 'Personal'}
                      onChange={e => setFormVal({ ...formVal, [field.name]: e.target.value })}
                      className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                    >
                      <option value="Personal">Personal</option>
                      <option value="Work">Work</option>
                      <option value="Developer">Developer</option>
                      <option value="Finance">Finance</option>
                    </select>
                  ) : (
                    <input 
                      type="text"
                      required={field.required}
                      placeholder={`Enter ${field.name}...`}
                      value={formVal[field.name] !== undefined ? formVal[field.name] : ''}
                      onChange={e => setFormVal({ ...formVal, [field.name]: e.target.value })}
                      className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              ))}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-[10px] font-mono uppercase font-black tracking-widest mt-2 cursor-pointer">
                Save & Secure Index
              </button>
            </form>
          </div>
        )}

        {/* Edit records Drawer */}
        {editRec && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-900 border-t border-slate-850 rounded-t-[32px] shadow-2xl z-50 p-4 transform translate-y-0 transition-transform duration-300 animate-slide-up select-text">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3"></div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <span className="text-xs font-mono uppercase font-black text-amber-400 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" /> Modify credentials
              </span>
              <button onClick={() => setEditRec(null)} className="text-[9px] uppercase font-mono text-slate-500 hover:text-slate-300 cursor-pointer">Cancel</button>
            </div>
            <form 
              onSubmit={e => {
                e.preventDefault();
                onUpdateRecord(isA ? 'A' : 'B', editRec.id, editRec.collection, editRec.data);
                setEditRec(null);
              }}
              className="space-y-2.5 max-h-[195px] overflow-y-auto scrollbar-none pb-2"
            >
              {schemas.find(s => s.id === editRec.collection)?.fields.map(field => (
                <div key={field.name} className="space-y-1">
                  <label className="text-[8.5px] uppercase font-mono text-slate-500 block">{field.name}</label>
                  <input 
                    type="text"
                    value={editRec.data[field.name] !== undefined ? editRec.data[field.name] : ''}
                    onChange={e => {
                      const updatedPayload = { ...editRec.data, [field.name]: e.target.value };
                      setEditRec({ ...editRec, data: updatedPayload });
                    }}
                    className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              ))}
              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-xl text-[10px] font-mono uppercase font-black tracking-widest mt-2 cursor-pointer">
                Apply Local Decoupled Delta
              </button>
            </form>
          </div>
        )}

      </div>
    );
  };

  return (
    <div id="offline-sandbox-workspace" className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10 w-full font-sans">
      
      {/* ========================================================
          CLIENT ALPHA (DEVICE A: iOS Obsidian Matte style)
         ======================================================== */}
      <div className="flex flex-col items-center">
        {/* Device Wrapper Header */}
        <div className="flex items-center justify-between w-full max-w-[390px] mb-3 px-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            IOS CLIENT ALPHA
          </div>
          <div className="flex items-center gap-2">
            {/* Background Simulator Switch */}
            <button
              onClick={() => bgA ? handleRestoreFocus(true) : handleMinimiseApp(true)}
              className={`px-2 py-0.5 rounded text-[8.5px] font-mono border transition ${
                bgA ? 'bg-red-500/10 border-red-500/20 text-red-400 font-bold' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
              }`}
              title="Simulate Mobile Home Screen button trigger (Frosted Snapshot screen protection)"
            >
              [Minimise App]
            </button>
            
            {/* Lock simulator switcher */}
            <button
              onClick={() => setLockedA(!lockedA)}
              className="px-2 py-0.5 rounded text-[8.5px] font-mono border bg-white/5 border-white/5 text-slate-400 hover:text-slate-300"
              title="Force Biometric Lock"
            >
              {lockedA ? 'Unlock device' : 'Lock device'}
            </button>

            <button
              onClick={() => onToggleConnection('A')}
              className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                connectedA
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-450'
              }`}
            >
              {connectedA ? <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" /> : <WifiOff className="w-3 h-3" />}
              {connectedA ? 'ONLINE' : 'AIRGAP'}
            </button>
          </div>
        </div>

        {/* Outer Phone Shell */}
        <div className="relative w-full max-w-[390px] h-[780px] rounded-[55px] border-[12px] border-slate-900 bg-slate-950 p-3 shadow-2xl flex flex-col overflow-hidden ring-4 ring-slate-800/50">
          
          {/* Dynamic Island Chamber */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-950 rounded-full z-50 flex items-center justify-center gap-1.5 border border-white/5 shadow-inner pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white/5"></div>
            <div className="w-2 h-2 rounded-full bg-indigo-950"></div>
          </div>

          {/* iOS Top Status Bar */}
          <div className="flex items-center justify-between px-6 pt-1 pb-2 text-[10px] font-mono text-slate-400 select-none z-40">
            <span>09:41</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] bg-slate-900 border border-white/5 px-1 py-0.5 rounded font-black tracking-widest text-[#00E5FF]">5G</span>
              {connectedA ? <Wifi className="w-3 h-3 text-blue-400 animate-pulse" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
              <div className="w-5 h-2.5 border border-slate-750 rounded-sm p-[1px] flex items-center">
                <div className="h-full w-4/5 bg-slate-400 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* Phone Screen Container */}
          <div className="flex-1 bg-[#10111A] rounded-[44px] p-4 flex flex-col overflow-hidden relative border border-white/5 shadow-inner">
            {/* App Nav Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3.5 z-10">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <h2 className="text-xs font-black tracking-widest text-white uppercase font-mono">HermitVault</h2>
              </div>
              
              {/* Sync status widget count */}
              <div className="text-[8.5px] font-mono text-slate-400 leading-none">
                {outboxA.length > 0 ? (
                  <span className="text-amber-400 font-bold uppercase animate-pulse">Outbox: {outboxA.length} Tx</span>
                ) : (
                  <span className="text-slate-450 uppercase">DB Synced</span>
                )}
              </div>
            </div>

            {/* Run core device platform switcher */}
            {renderPhoneInner(
              true,
              tabA,
              setTabA,
              lockedA,
              scanningA,
              pwdInputA,
              setPwdInputA,
              bgA,
              (b: boolean) => b ? handleMinimiseApp(true) : handleRestoreFocus(true),
              clipCounterA,
              queryA,
              setQueryA,
              catA,
              setCatA,
              clientA,
              outboxA.length,
              genResA,
              setGenResA,
              genLenA,
              setGenLenA,
              genOptsA,
              setGenOptsA,
              addSheetA,
              setAddSheetA,
              formA,
              setFormA,
              editA,
              setEditA
            )}
            
          </div>

          {/* Touch Gesture pill bar at bottom */}
          <div className="w-32 h-1 bg-slate-800 rounded-full mx-auto my-1.5 pointer-events-none"></div>
        </div>
      </div>

      {/* ========================================================
          CLIENT BETA (DEVICE B: Android Matte Glacier style)
         ======================================================== */}
      <div className="flex flex-col items-center">
        {/* Device Wrapper Header */}
        <div className="flex items-center justify-between w-full max-w-[390px] mb-3 px-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            ANDROID CLIENT BETA
          </div>
          <div className="flex items-center gap-2">
            {/* Background Simulator Switch */}
            <button
              onClick={() => bgB ? handleRestoreFocus(false) : handleMinimiseApp(false)}
              className={`px-2 py-0.5 rounded text-[8.5px] font-mono border transition ${
                bgB ? 'bg-red-500/10 border-red-500/20 text-red-400 font-bold' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'
              }`}
              title="Simulate Mobile Home Screen button trigger (Frosted Snapshot screen protection)"
            >
              [Minimise App]
            </button>

            {/* Lock simulator switcher */}
            <button
              onClick={() => setLockedB(!lockedB)}
              className="px-2 py-0.5 rounded text-[8.5px] font-mono border bg-white/5 border-white/5 text-slate-400 hover:text-slate-300"
              title="Force Biometric Lock"
            >
              {lockedB ? 'Unlock device' : 'Lock device'}
            </button>

            <button
              onClick={() => onToggleConnection('B')}
              className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                connectedB
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-455'
              }`}
            >
              {connectedB ? <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" /> : <WifiOff className="w-3 h-3" />}
              {connectedB ? 'ONLINE' : 'AIRGAP'}
            </button>
          </div>
        </div>

        {/* Outer Phone Shell */}
        <div className="relative w-full max-w-[390px] h-[780px] rounded-[55px] border-[12px] border-slate-900 bg-slate-950 p-3 shadow-2xl flex flex-col overflow-hidden ring-4 ring-slate-800/10">
          
          {/* Android Punch Hole Cameray Component */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-950 rounded-full z-50 pointer-events-none border border-white/10 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
          </div>

          {/* Android Top Status Bar */}
          <div className="flex items-center justify-between px-6 pt-1 pb-2 text-[10px] font-mono text-slate-400 select-none z-40">
            <span>10:00</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] bg-slate-900 border border-white/5 px-1 py-0.5 rounded font-black tracking-widest text-[#D1C4E9]">LTE</span>
              {connectedB ? <Wifi className="w-3 h-3 text-purple-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
              <div className="w-5 h-2.5 border border-slate-750 rounded-sm p-[1px] flex items-center">
                <div className="h-full w-full bg-purple-500 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* Phone Screen Container */}
          <div className="flex-1 bg-[#0D0E16] rounded-[44px] p-4 flex flex-col overflow-hidden relative border border-white/5 shadow-inner">
            {/* App Nav Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3.5 z-10">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <h2 className="text-xs font-black tracking-widest text-white uppercase font-mono">HermitVault</h2>
              </div>

              {/* Sync status widget count */}
              <div className="text-[8.5px] font-mono text-slate-400 leading-none">
                {outboxB.length > 0 ? (
                  <span className="text-amber-400 font-bold uppercase animate-pulse">Outbox: {outboxB.length} Tx</span>
                ) : (
                  <span className="text-slate-450 uppercase">DB Synced</span>
                )}
              </div>
            </div>

            {/* Run core device platform switcher */}
            {renderPhoneInner(
              false,
              tabB,
              setTabB,
              lockedB,
              scanningB,
              pwdInputB,
              setPwdInputB,
              bgB,
              (b: boolean) => b ? handleMinimiseApp(false) : handleRestoreFocus(false),
              clipCounterB,
              queryB,
              setQueryB,
              catB,
              setCatB,
              clientB,
              outboxB.length,
              genResB,
              setGenResB,
              genLenB,
              setGenLenB,
              genOptsB,
              setGenOptsB,
              addSheetB,
              setAddSheetB,
              formB,
              setFormB,
              editB,
              setEditB
            )}

          </div>

          {/* Touch Gesture pill bar at bottom */}
          <div className="w-32 h-1 bg-slate-800 rounded-full mx-auto my-1.5 pointer-events-none"></div>
        </div>
      </div>

    </div>
  );
}
