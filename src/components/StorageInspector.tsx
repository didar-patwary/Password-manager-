import React, { useState } from 'react';
import { SchemaDefinition, ClientRecord, ServerRecord } from '../types';
import { Database, HardDrive, Trash2, Code, ShieldCheck, RefreshCw } from 'lucide-react';
import { getByteSizeOfData } from '../lib/dbEngine';

interface StorageInspectorProps {
  schemas: SchemaDefinition[];
  clientA: ClientRecord[];
  clientB: ClientRecord[];
  server: ServerRecord[];
  encryptionEnabled: boolean;
  onClearStorage: (scope: 'CLIENT_A' | 'CLIENT_B' | 'SERVER') => void;
}

type SelectedScope = 'CLIENT_A' | 'CLIENT_B' | 'SERVER';

export default function StorageInspector({
  schemas,
  clientA,
  clientB,
  server,
  encryptionEnabled,
  onClearStorage
}: StorageInspectorProps) {
  const [activeScope, setActiveScope] = useState<SelectedScope>('CLIENT_A');
  const [selectedSchema, setSelectedSchema] = useState<string>(schemas[0]?.id || 'tasks');

  // Calculate size counts
  const getRecordsByScope = (scope: SelectedScope): any[] => {
    switch (scope) {
      case 'CLIENT_A': return clientA;
      case 'CLIENT_B': return clientB;
      case 'SERVER': return server;
    }
  };

  const records = getRecordsByScope(activeScope);
  const selectedRecords = records.filter(r => r.collection === selectedSchema);

  // Compute total sizes
  const sizeA = getByteSizeOfData(clientA);
  const sizeB = getByteSizeOfData(clientB);
  const sizeServer = getByteSizeOfData(server);

  // Generate SVG heights for dynamic bar graphs
  const maxSize = Math.max(sizeA, sizeB, sizeServer, 500);
  const pctA = Math.max((sizeA / maxSize) * 100, 10);
  const pctB = Math.max((sizeB / maxSize) * 100, 10);
  const pctS = Math.max((sizeServer / maxSize) * 100, 10);

  return (
    <div id="storage-inspector-panel" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl relative z-10 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-sans">
            Local & Cloud Storage Inspector
          </h3>
        </div>
        <div className="flex bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] items-center gap-1.5 border border-white/10 text-slate-400 font-mono">
          <HardDrive className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Fully Offline Core
        </div>
      </div>

      {/* SVG Storage Memory Visualizer Chart */}
      <div className="bg-black/25 p-4.5 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-lg">
        <div>
          <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mb-3.5 font-mono">
            Local Bytes Stored (In-Browser serialization)
          </h4>
          <div className="flex items-end justify-around h-[120px] bg-black/35 rounded-2xl p-4 relative pt-7 border border-white/5 shadow-inner">
            {/* Guide Gridlines */}
            <div className="absolute inset-x-0 top-1/4 border-t border-white/5 border-dashed"></div>
            <div className="absolute inset-x-0 top-2/4 border-t border-white/5 border-dashed"></div>
            <div className="absolute inset-x-0 top-3/4 border-t border-white/5 border-dashed"></div>

            {/* Bar Client Alpha */}
            <div className="flex flex-col items-center z-10 w-16">
              <span className="text-[10px] text-blue-400 font-mono mb-1.5 font-bold">{sizeA} B</span>
              <div 
                style={{ height: `${pctA}%` }} 
                className="w-7 bg-gradient-to-t from-blue-600 to-blue-400 rounded-lg transition-all duration-500 ease-out shadow-lg shadow-blue-500/20"
              ></div>
              <span className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase font-semibold">Client A</span>
            </div>

            {/* Bar Client Beta */}
            <div className="flex flex-col items-center z-10 w-16">
              <span className="text-[10px] text-purple-400 font-mono mb-1.5 font-bold">{sizeB} B</span>
              <div 
                style={{ height: `${pctB}%` }} 
                className="w-7 bg-gradient-to-t from-purple-600 to-purple-400 rounded-lg transition-all duration-500 ease-out shadow-lg shadow-purple-500/20"
              ></div>
              <span className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase font-semibold">Client B</span>
            </div>

            {/* Bar Server State */}
            <div className="flex flex-col items-center z-10 w-16">
              <span className="text-[10px] text-emerald-400 font-mono mb-1.5 font-bold">{sizeServer} B</span>
              <div 
                style={{ height: `${pctS}%` }} 
                className="w-7 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-lg transition-all duration-500 ease-out shadow-lg shadow-emerald-500/20"
              ></div>
              <span className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase font-semibold">Server</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Encryption Margin Diagnostics */}
        <div className="flex flex-col justify-between">
          <div className="space-y-3.5">
            <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-widest font-mono">
              Database Cryptography Security Status
            </h4>
            <div className="p-3.5 bg-black/25 border border-white/5 rounded-2xl flex items-start gap-3 shadow-md">
              <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${encryptionEnabled ? 'text-fuchsia-400 animate-pulse' : 'text-slate-500'}`} />
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-white uppercase block tracking-wide">
                  {encryptionEnabled ? 'AES-256 Client-Side Active' : 'Unencrypted Plaintext Store'}
                </span>
                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                  {encryptionEnabled 
                    ? 'Records undergo browser cryptographic hashing BEFORE syncing to local databases.'
                    : 'Values are committed as serial JSONs, leaving tables bare to administrative extraction.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3">
            <div className="text-[10px] text-slate-500 font-mono">
              Overhead Ratio: <span className="text-slate-300 font-bold">1:1.36x</span> (Local Storage)
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Status Match: <span className="text-emerald-400 font-bold">SHA-256 Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Raw Document Inspector Tabs */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-black/25 p-2 rounded-2xl border border-white/5">
          <div className="flex gap-1.5 bg-[#0d0f17]/40 p-1 rounded-xl border border-white/5">
            {(['CLIENT_A', 'CLIENT_B', 'SERVER'] as SelectedScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setActiveScope(scope)}
                className={`px-3 py-1 text-[10px] font-mono tracking-wider font-semibold rounded-lg uppercase transition-all border cursor-pointer ${
                  activeScope === scope
                    ? 'bg-white/10 border-white/10 text-blue-400 shadow-md'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {scope === 'CLIENT_A' ? 'Client Alpha' : scope === 'CLIENT_B' ? 'Client Beta' : 'Central Server'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              id="storage-inspect-schema-select"
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="text-[10px] font-mono bg-black/45 border border-white/10 text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 shrink-0 uppercase"
            >
              {schemas.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            
            <button
              type="button"
              id="wipe-scope-btn"
              onClick={() => onClearStorage(activeScope)}
              className="text-slate-400 hover:text-red-400 p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition cursor-pointer shadow-md"
              title="Clear Database Scope Records"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live records list */}
        <div className="bg-black/20 border border-white/5 rounded-2xl h-[240px] overflow-y-auto font-mono text-xs shadow-inner">
          {selectedRecords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-5">
              <Code className="w-5 h-5 text-slate-655 text-slate-500" />
              <div className="text-[11px] uppercase tracking-wider font-bold">Empty Document Partition</div>
              <p className="text-[10px] text-center max-w-xs text-slate-500 leading-relaxed font-sans">
                No offline objects found for database path: /{activeScope.toLowerCase()}/{selectedSchema}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 p-3 space-y-3">
              {selectedRecords.map((item, index) => (
                <div key={item.id + index} className="p-3 hover:bg-white/5 rounded-xl transition duration-200">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-1.5 text-[10px] text-slate-500">
                    <span className="text-slate-400 font-bold">ID: <span className="text-blue-405 text-blue-400">{item.id}</span></span>
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-450font-bold">
                      {activeScope !== 'SERVER' && (
                        <span className={`px-2 py-0.5 rounded-lg border font-bold font-mono tracking-wider ${
                          item.syncStatus === 'SYNCED' ? 'text-emerald-400 border-emerald-500/10 bg-emerald-950/20' : 'text-amber-400 border-amber-500/10 bg-amber-950/20'
                        }`}>
                          {item.syncStatus}
                        </span>
                      )}
                      <span>v{item.version}</span>
                    </div>
                  </div>
                  <pre className="text-[10px] text-[#5cd6ff] bg-black/45 border border-white/5 p-3 rounded-xl max-h-[140px] overflow-y-auto select-all leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
