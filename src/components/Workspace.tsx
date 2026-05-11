import React, { useState } from 'react';
import { SchemaDefinition, ClientRecord, SyncStatus, OutboxItem } from '../types';
import { Laptop, Wifi, WifiOff, Plus, FileText, Send, Trash, Edit3, ArrowRight } from 'lucide-react';

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
  onDeleteRecord
}: WorkspaceProps) {
  // Active selected schemas for form entries on each client
  const [selectedSchemaA, setSelectedSchemaA] = useState(schemas[0]?.id || 'tasks');
  const [selectedSchemaB, setSelectedSchemaB] = useState(schemas[0]?.id || 'tasks');

  // Dynamic values form states for each client
  const [formA, setFormA] = useState<any>({});
  const [formB, setFormB] = useState<any>({});
  
  // Modals/expand states for record edit mode
  const [editTargetA, setEditTargetA] = useState<ClientRecord | null>(null);
  const [editTargetB, setEditTargetB] = useState<ClientRecord | null>(null);

  // Parse active schema fields
  const currentSchemaA = schemas.find(s => s.id === selectedSchemaA) || schemas[0];
  const currentSchemaB = schemas.find(s => s.id === selectedSchemaB) || schemas[0];

  const handleCreateA = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {};
    currentSchemaA.fields.forEach(f => {
      payload[f.name] = formA[f.name] !== undefined ? formA[f.name] : f.defaultValue || '';
    });
    onAddRecord('A', selectedSchemaA, payload);
    setFormA({}); // Clear form
  };

  const handleCreateB = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {};
    currentSchemaB.fields.forEach(f => {
      payload[f.name] = formB[f.name] !== undefined ? formB[f.name] : f.defaultValue || '';
    });
    onAddRecord('B', selectedSchemaB, payload);
    setFormB({}); // Clear form
  };

  const handleSaveEditA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetA) return;
    onUpdateRecord('A', editTargetA.id, editTargetA.collection, editTargetA.data);
    setEditTargetA(null);
  };

  const handleSaveEditB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetB) return;
    onUpdateRecord('B', editTargetB.id, editTargetB.collection, editTargetB.data);
    setEditTargetB(null);
  };

  const handleFieldChangeA = (fieldName: string, value: any) => {
    setFormA((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  const handleFieldChangeB = (fieldName: string, value: any) => {
    setFormB((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  return (
    <div id="offline-sandbox-workspace" className="grid grid-cols-1 xl:grid-cols-2 gap-6 relative z-10">
      
      {/* ========================================================
          CLIENT ALPHA (DEVICE A) PANEL
         ======================================================== */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl flex flex-col relative">
        {/* Device Bezel Header */}
        <div className="bg-white/5 border border-white/5 px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-inner backdrop-blur-md mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
            <Laptop className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
              Client Alpha Workspace (Device A)
            </span>
          </div>

          {/* Network Connection Toggle Button */}
          <button
            type="button"
            id="toggle-conn-a-btn"
            onClick={() => onToggleConnection('A')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border cursor-pointer ${
              connectedA
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            {connectedA ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse" /> Online
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" /> Offline Mode
              </>
            )}
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 flex flex-col space-y-5">
          {/* Form Create Block */}
          {!editTargetA ? (
            <form onSubmit={handleCreateA} className="bg-black/25 p-4.5 rounded-2xl border border-white/5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase text-slate-350 font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-400" /> Add Record (Local store)
                </span>
                <select
                  id="schema-select-a"
                  value={selectedSchemaA}
                  onChange={(e) => setSelectedSchemaA(e.target.value)}
                  className="bg-black/45 border border-white/10 text-[10px] font-mono rounded-lg px-2.5 py-1 text-slate-300 uppercase focus:outline-none"
                >
                  {schemas.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Dynamically build form inputs according to schema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1.5">
                {currentSchemaA?.fields.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <label htmlFor={`field-a-${field.name}`} className="text-[10px] uppercase font-mono text-slate-500 font-semibold block">
                      {field.name} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    
                    {field.type === 'boolean' ? (
                      <select
                        id={`field-a-${field.name}`}
                        className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50"
                        value={formA[field.name] !== undefined ? String(formA[field.name]) : 'false'}
                        onChange={e => handleFieldChangeA(field.name, e.target.value === 'true')}
                      >
                        <option value="false">FALSE</option>
                        <option value="true">TRUE</option>
                      </select>
                    ) : field.type === 'array' ? (
                      <input
                        id={`field-a-${field.name}`}
                        type="text"
                        placeholder="Comma separated tags..."
                        className="w-full text-xs font-mono bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50"
                        value={formA[field.name] !== undefined ? formA[field.name] : ''}
                        onChange={e => handleFieldChangeA(field.name, e.target.value.split(',').map(s => s.trim()))}
                      />
                    ) : (
                      <input
                        id={`field-a-${field.name}`}
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        placeholder={`Enter ${field.name}...`}
                        className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50"
                        value={formA[field.name] !== undefined ? formA[field.name] : ''}
                        onChange={e => handleFieldChangeA(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                id="submit-record-a-btn"
                className="w-full bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/15 text-blue-400 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/5 hover:text-blue-300 hover:border-blue-500/25 cursor-pointer"
              >
                Insert Outbox Record <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* Editing State card inline */
            <form onSubmit={handleSaveEditA} className="bg-amber-500/5 p-4.5 rounded-2xl border border-amber-550/25 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <span className="text-xs font-mono uppercase text-amber-400 font-semibold flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" /> Editing Offline Object: {editTargetA.id}
                </span>
                <button 
                  type="button" 
                  id="cancel-edit-a-btn"
                  onClick={() => setEditTargetA(null)} 
                  className="text-slate-400 hover:text-slate-200 font-mono text-[10px] uppercase underline"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {schemas.find(s => s.id === editTargetA.collection)?.fields.map((f) => (
                  <div key={f.name} className="space-y-1">
                    <label htmlFor={`edit-field-a-${f.name}`} className="text-[10px] uppercase font-mono text-slate-500 font-semibold block">{f.name}</label>
                    <input
                      id={`edit-field-a-${f.name}`}
                      type="text"
                      className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                      value={editTargetA.data[f.name] !== undefined ? editTargetA.data[f.name] : ''}
                      onChange={e => {
                        const nextData = { ...editTargetA.data, [f.name]: e.target.value };
                        setEditTargetA({ ...editTargetA, data: nextData });
                      }}
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                id="save-edit-a-btn"
                className="w-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors"
              >
                Save Local Mutation
              </button>
            </form>
          )}

          {/* Pending Changes Badge */}
          {outboxA.length > 0 && (
            <div className="bg-amber-550/5 border border-amber-500/15 rounded-xl p-3 flex items-center justify-between text-xs font-mono text-amber-400 animate-pulse">
              <span className="font-bold">SYNC OUTBOX: {outboxA.length} TRANSACTION(S) QUEUED</span>
              <span className="text-[9px] uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg font-bold text-amber-400">
                PENDING OFFLINE
              </span>
            </div>
          )}

          {/* Records Lists */}
          <div className="space-y-2.5 flex-1">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500 flex items-center justify-between border-b border-white/5 pb-1.5">
              <span>Local Client-Side View (Active Database rows)</span>
              <span className="text-slate-400 font-medium font-mono">Count: {clientA.length}</span>
            </span>

            {clientA.length === 0 ? (
              <div className="bg-black/15 p-8 rounded-2xl border border-white/5 text-center text-slate-500 font-mono text-[11px] uppercase">
                Empty Local Workspace
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {clientA.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-3.5 rounded-xl border hover:border-white/10 transition flex items-center justify-between ${
                      item.syncStatus === SyncStatus.SYNCED 
                        ? 'bg-white/5 border-white/5 hover:bg-white/10' 
                        : 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10'
                    }`}
                  >
                    <div className="space-y-1 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wide">
                          {item.id}
                        </span>
                        <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-450 px-1.5 py-0.5 rounded-full uppercase font-mono font-bold tracking-wider">
                          {item.collection}
                        </span>
                      </div>
                      
                      {/* Flex content render */}
                      <p className="text-[11px] text-slate-400 truncate leading-relaxed">
                        {Object.entries(item.data)
                          .filter(([key]) => key !== 'id')
                          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                          .join(' | ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      {item.syncStatus !== SyncStatus.SYNCED && (
                        <span className="text-[9px] font-bold text-amber-400 border border-amber-500/20 bg-amber-950/30 px-1.5 py-0.5 rounded-lg uppercase">
                          Queued
                        </span>
                      )}
                      
                      <button
                        type="button"
                        id={`edit-a-${item.id}`}
                        onClick={() => setEditTargetA(item)}
                        className="text-slate-400 hover:text-amber-400 p-1.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition"
                        title="Edit local row offline"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`delete-a-${item.id}`}
                        onClick={() => onDeleteRecord('A', item.id, item.collection)}
                        className="text-slate-400 hover:text-red-400 p-1.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition"
                        title="Delete record offline"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          CLIENT BETA (DEVICE B) PANEL
         ======================================================== */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl flex flex-col relative">
        {/* Device Bezel Header */}
        <div className="bg-white/5 border border-white/5 px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-inner backdrop-blur-md mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></span>
            <Laptop className="w-4 h-4 text-purple-400" />
            <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
              Client Beta Workspace (Device B)
            </span>
          </div>

          {/* Network Connection Toggle Button */}
          <button
            type="button"
            id="toggle-conn-b-btn"
            onClick={() => onToggleConnection('B')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border cursor-pointer ${
              connectedB
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            {connectedB ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse" /> Online
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" /> Offline Mode
              </>
            )}
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 flex flex-col space-y-5">
          {/* Form Create Block */}
          {!editTargetB ? (
            <form onSubmit={handleCreateB} className="bg-black/25 p-4.5 rounded-2xl border border-white/5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase text-slate-355 font-bold flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-purple-400" /> Add Record (Local store)
                </span>
                <select
                  id="schema-select-b"
                  value={selectedSchemaB}
                  onChange={(e) => setSelectedSchemaB(e.target.value)}
                  className="bg-black/45 border border-white/10 text-[10px] font-mono rounded-lg px-2.5 py-1 text-slate-300 uppercase focus:outline-none"
                >
                  {schemas.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Dynamically build form inputs according to schema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1.5">
                {currentSchemaB?.fields.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <label htmlFor={`field-b-${field.name}`} className="text-[10px] uppercase font-mono text-slate-500 font-semibold block">
                      {field.name} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    
                    {field.type === 'boolean' ? (
                      <select
                        id={`field-b-${field.name}`}
                        className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                        value={formB[field.name] !== undefined ? String(formB[field.name]) : 'false'}
                        onChange={e => handleFieldChangeB(field.name, e.target.value === 'true')}
                      >
                        <option value="false">FALSE</option>
                        <option value="true">TRUE</option>
                      </select>
                    ) : field.type === 'array' ? (
                      <input
                        id={`field-b-${field.name}`}
                        type="text"
                        placeholder="Comma separated tags..."
                        className="w-full text-xs font-mono bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                        value={formB[field.name] !== undefined ? formB[field.name] : ''}
                        onChange={e => handleFieldChangeB(field.name, e.target.value.split(',').map(s => s.trim()))}
                      />
                    ) : (
                      <input
                        id={`field-b-${field.name}`}
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        placeholder={`Enter ${field.name}...`}
                        className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                        value={formB[field.name] !== undefined ? formB[field.name] : ''}
                        onChange={e => handleFieldChangeB(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                id="submit-record-b-btn"
                className="w-full bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/15 text-purple-400 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/5 hover:text-purple-300 hover:border-purple-500/25 cursor-pointer"
              >
                Insert Outbox Record <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* Editing State card inline B */
            <form onSubmit={handleSaveEditB} className="bg-amber-500/5 p-4.5 rounded-2xl border border-amber-550/25 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-mono uppercase text-amber-400 font-semibold flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" /> Editing Offline Object: {editTargetB.id}
                </span>
                <button 
                  type="button" 
                  id="cancel-edit-b-btn"
                  onClick={() => setEditTargetB(null)} 
                  className="text-slate-400 hover:text-slate-200 font-mono text-[10px] uppercase underline"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {schemas.find(s => s.id === editTargetB.collection)?.fields.map((f) => (
                  <div key={f.name} className="space-y-1">
                    <label htmlFor={`edit-field-b-${f.name}`} className="text-[10px] uppercase font-mono text-slate-500 font-semibold block">{f.name}</label>
                    <input
                      id={`edit-field-b-${f.name}`}
                      type="text"
                      className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                      value={editTargetB.data[f.name] !== undefined ? editTargetB.data[f.name] : ''}
                      onChange={e => {
                        const nextData = { ...editTargetB.data, [f.name]: e.target.value };
                        setEditTargetB({ ...editTargetB, data: nextData });
                      }}
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                id="save-edit-b-btn"
                className="w-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors"
              >
                Save Local Mutation
              </button>
            </form>
          )}

          {/* Pending Changes Badge */}
          {outboxB.length > 0 && (
            <div className="bg-amber-550/5 border border-amber-500/15 rounded-xl p-3 flex items-center justify-between text-xs font-mono text-amber-400 animate-pulse font-semibold">
              <span>SYNC OUTBOX: {outboxB.length} TRANSACTION(S) QUEUED</span>
              <span className="text-[9px] uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg font-bold text-amber-400">
                PENDING OFFLINE
              </span>
            </div>
          )}

          {/* Records Lists */}
          <div className="space-y-2.5 flex-1">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500 flex items-center justify-between border-b border-white/5 pb-1.5">
              <span>Local Client-Side View (Active Database rows)</span>
              <span className="text-slate-450 font-medium font-mono">Count: {clientB.length}</span>
            </span>

            {clientB.length === 0 ? (
              <div className="bg-black/15 p-8 rounded-2xl border border-white/5 text-center text-slate-500 font-mono text-[11px] uppercase">
                Empty Local Workspace
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {clientB.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-3.5 rounded-xl border hover:border-white/10 transition flex items-center justify-between ${
                      item.syncStatus === SyncStatus.SYNCED 
                        ? 'bg-white/5 border-white/5 hover:bg-white/10' 
                        : 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10'
                    }`}
                  >
                    <div className="space-y-1 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wide">
                          {item.id}
                        </span>
                        <span className="text-[8px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full uppercase font-mono font-bold tracking-wider">
                          {item.collection}
                        </span>
                      </div>
                      
                      {/* Flex content render */}
                      <p className="text-[11px] text-slate-400 truncate leading-relaxed">
                        {Object.entries(item.data)
                          .filter(([key]) => key !== 'id')
                          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                          .join(' | ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      {item.syncStatus !== SyncStatus.SYNCED && (
                        <span className="text-[9px] font-bold text-amber-400 border border-amber-500/20 bg-amber-950/30 px-1.5 py-0.5 rounded-lg uppercase">
                          Queued
                        </span>
                      )}
                      
                      <button
                        type="button"
                        id={`edit-b-${item.id}`}
                        onClick={() => setEditTargetB(item)}
                        className="text-slate-400 hover:text-amber-400 p-1.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition"
                        title="Edit local row offline"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`delete-b-${item.id}`}
                        onClick={() => onDeleteRecord('B', item.id, item.collection)}
                        className="text-slate-400 hover:text-red-400 p-1.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition"
                        title="Delete record offline"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
