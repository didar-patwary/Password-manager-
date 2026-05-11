import React, { useState, useEffect, ChangeEvent } from 'react';
import { 
  SyncStatus, 
  SchemaDefinition, 
  ClientRecord, 
  ServerRecord, 
  OutboxItem, 
  LogEntry, 
  SyncConflict 
} from './types';
import { 
  DEFAULT_SCHEMAS, 
  getInitialRecords, 
  getByteSizeOfData, 
  encryptPayload, 
  decryptString, 
  generateSQLiteBackup, 
  detectConflictingTransactions 
} from './lib/dbEngine';

import Workspace from './components/Workspace';
import StorageInspector from './components/StorageInspector';
import SchemaBuilder from './components/SchemaBuilder';
import CryptModule from './components/CryptModule';
import Terminal from './components/Terminal';
import { generateMnemonicPhrase } from './lib/secureCrypto';

// Icons
import { 
  Server, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Download, 
  Upload, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Terminal as TermIcon, 
  FolderSync, 
  RefreshCw as RefreshIcon,
  Sparkles,
  BookOpen
} from 'lucide-react';

export default function App() {
  // ----------------------------------------------------------------
  // CORE STATE
  // ----------------------------------------------------------------
  const [schemas, setSchemas] = useState<SchemaDefinition[]>(() => {
    const saved = localStorage.getItem('hermit_schemas');
    return saved ? JSON.parse(saved) : DEFAULT_SCHEMAS;
  });

  const [serverDB, setServerDB] = useState<ServerRecord[]>(() => {
    const saved = localStorage.getItem('hermit_server_db');
    return saved ? JSON.parse(saved) : getInitialRecords().server;
  });

  const [clientADB, setClientADB] = useState<ClientRecord[]>(() => {
    const saved = localStorage.getItem('hermit_client_a_db');
    return saved ? JSON.parse(saved) : getInitialRecords().clientA;
  });

  const [clientBDB, setClientBDB] = useState<ClientRecord[]>(() => {
    const saved = localStorage.getItem('hermit_client_b_db');
    return saved ? JSON.parse(saved) : getInitialRecords().clientB;
  });

  const [outboxA, setOutboxA] = useState<OutboxItem[]>(() => {
    const saved = localStorage.getItem('hermit_outbox_a');
    return saved ? JSON.parse(saved) : [];
  });

  const [outboxB, setOutboxB] = useState<OutboxItem[]>(() => {
    const saved = localStorage.getItem('hermit_outbox_b');
    return saved ? JSON.parse(saved) : [];
  });

  const [connectedA, setConnectedA] = useState(true);
  const [connectedB, setConnectedB] = useState(false); // Start off asymmetrical for interesting demos!
  const [syncSpeed, setSyncSpeed] = useState<'instant' | 'slow'>('instant');
  
  // Encryption states
  const [encryptionEnabled, setEncryptionEnabled] = useState(() => {
    return localStorage.getItem('hermit_crypt_enabled') === 'true';
  });
  const [secretKey, setSecretKey] = useState(() => {
    return localStorage.getItem('hermit_secret_key') || 'hermit-local-token-931';
  });

  // Zero-Knowledge Recovery Phrase States
  const [recoveryPhrase, setRecoveryPhrase] = useState(() => {
    const saved = localStorage.getItem('hermit_recovery_phrase');
    if (saved) return saved;
    const phrase = generateMnemonicPhrase();
    return phrase;
  });
  const [recoveryVerified, setRecoveryVerified] = useState(() => {
    return localStorage.getItem('hermit_recovery_verified') === 'true';
  });

  // Current active sync conflicts discovered
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  // Selected visual active workspace view
  const [activeTab, setActiveTab] = useState<'workspace' | 'schemas' | 'inspector' | 'security' | 'blueprint'>('workspace');

  // Diagnostics scrolling terminal logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);

  // ----------------------------------------------------------------
  // LOCAL PERSISTENCE SYNC
  // ----------------------------------------------------------------
  useEffect(() => {
    localStorage.setItem('hermit_schemas', JSON.stringify(schemas));
  }, [schemas]);

  useEffect(() => {
    localStorage.setItem('hermit_server_db', JSON.stringify(serverDB));
  }, [serverDB]);

  useEffect(() => {
    localStorage.setItem('hermit_client_a_db', JSON.stringify(clientADB));
  }, [clientADB]);

  useEffect(() => {
    localStorage.setItem('hermit_client_b_db', JSON.stringify(clientBDB));
  }, [clientBDB]);

  useEffect(() => {
    localStorage.setItem('hermit_outbox_a', JSON.stringify(outboxA));
  }, [outboxA]);

  useEffect(() => {
    localStorage.setItem('hermit_outbox_b', JSON.stringify(outboxB));
  }, [outboxB]);

  useEffect(() => {
    localStorage.setItem('hermit_crypt_enabled', String(encryptionEnabled));
  }, [encryptionEnabled]);

  useEffect(() => {
    localStorage.setItem('hermit_secret_key', secretKey);
  }, [secretKey]);

  useEffect(() => {
    localStorage.setItem('hermit_recovery_phrase', recoveryPhrase);
  }, [recoveryPhrase]);

  useEffect(() => {
    localStorage.setItem('hermit_recovery_verified', String(recoveryVerified));
  }, [recoveryVerified]);

  // Boot up seed message logs
  useEffect(() => {
    addLog('SYSTEM', 'info', 'Sandbox storage drivers initialized. LocalStorage binding complete.');
    addLog('SYSTEM', 'success', `Zero-knowledge keys loaded via virtual PBKDF2 context ${secretKey.substring(0, 4)}****`);
    addLog('SYSTEM', 'crypto', 'Zero-Knowledge 24-word Emergency Seed Phrase initialized securely.');
    addLog('SERVER', 'info', `Local server state validated. ${serverDB.length} primary keys monitored.`);
  }, []);

  // ----------------------------------------------------------------
  // LOGGER FUNCTIONS
  // ----------------------------------------------------------------
  const addLog = (
    source: 'SYSTEM' | 'CLIENT_A' | 'CLIENT_B' | 'SERVER',
    type: 'info' | 'success' | 'warn' | 'error' | 'crypto' | 'sync',
    message: string
  ) => {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      type,
      source,
      message
    };
    setLogs(prev => [...prev, entry].slice(-150)); // cap logs at 150 items
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLog('SYSTEM', 'info', 'Diagnostic frame cleared.');
  };

  // ----------------------------------------------------------------
  // RECORD ACTIONS (CREATE, UPDATE, DELETE)
  // ----------------------------------------------------------------
  const handleAddRecord = (client: 'A' | 'B', collectionId: string, inputData: any) => {
    const id = `${collectionId === 'tasks' ? 'task' : collectionId === 'notes' ? 'note' : collectionId === 'contacts' ? 'contact' : 'custom'}_${Date.now()}`;
    const timestamp = Date.now();
    
    // Schema default values binding
    const schema = schemas.find(s => s.id === collectionId);
    const completeData: any = { id };
    if (schema) {
      schema.fields.forEach(f => {
        completeData[f.name] = inputData[f.name] !== undefined ? inputData[f.name] : f.defaultValue || '';
      });
    }

    // Encrypt values in-transit if enabled BEFORE writing client store
    const storedData = encryptionEnabled ? encryptPayload(completeData, secretKey) : { ...completeData };

    const newRecord: ClientRecord = {
      id,
      collection: collectionId,
      data: storedData,
      updatedAt: timestamp,
      clientScopeId: `CLIENT_${client}`,
      syncStatus: SyncStatus.PENDING,
      version: 1,
    };

    const outboxItem: OutboxItem = {
      id: `tx_${client}_${Date.now()}`,
      operation: 'CREATE',
      collection: collectionId,
      documentId: id,
      payload: storedData,
      timestamp,
      clientScopeId: `CLIENT_${client}`
    };

    if (client === 'A') {
      setClientADB(prev => [newRecord, ...prev]);
      setOutboxA(prev => [...prev, outboxItem]);
      addLog('CLIENT_A', 'success', `[Optimistic UI] Inserted row '${id}' to local '/${collectionId}' collection.`);
      
      // If connected, sync immediately!
      if (connectedA) {
        addLog('CLIENT_A', 'sync', `Alpha is connected online. Triggering automatic sync push.`);
        triggerSyncForClient('A', [outboxItem]);
      } else {
        addLog('CLIENT_A', 'warn', `Device A is OFFLINE. Mutation transaction TX_${outboxItem.id} cached in outbox.`);
      }
    } else {
      setClientBDB(prev => [newRecord, ...prev]);
      setOutboxB(prev => [...prev, outboxItem]);
      addLog('CLIENT_B', 'success', `[Optimistic UI] Inserted row '${id}' to local '/${collectionId}' collection.`);
      
      if (connectedB) {
        addLog('CLIENT_B', 'sync', `Beta is connected online. Triggering automatic sync push.`);
        triggerSyncForClient('B', [outboxItem]);
      } else {
        addLog('CLIENT_B', 'warn', `Device B is OFFLINE. Mutation transaction TX_${outboxItem.id} cached in outbox.`);
      }
    }
  };

  const handleUpdateRecord = (client: 'A' | 'B', recordId: string, collectionId: string, rawData: any) => {
    const timestamp = Date.now();
    const storedData = encryptionEnabled ? encryptPayload(rawData, secretKey) : { ...rawData };

    const updateOutbox: OutboxItem = {
      id: `tx_${client}_${Date.now()}`,
      operation: 'UPDATE',
      collection: collectionId,
      documentId: recordId,
      payload: storedData,
      timestamp,
      clientScopeId: `CLIENT_${client}`
    };

    if (client === 'A') {
      setClientADB(prev => prev.map(r => r.id === recordId ? { ...r, data: storedData, updatedAt: timestamp, syncStatus: SyncStatus.PENDING } : r));
      setOutboxA(prev => [...prev, updateOutbox]);
      addLog('CLIENT_A', 'info', `[Optimistic UI] Mutated row '${recordId}' content offline.`);
      
      if (connectedA) {
        triggerSyncForClient('A', [updateOutbox]);
      } else {
        addLog('CLIENT_A', 'warn', `A is offline. Cached update transaction to localStorage outbox.`);
      }
    } else {
      setClientBDB(prev => prev.map(r => r.id === recordId ? { ...r, data: storedData, updatedAt: timestamp, syncStatus: SyncStatus.PENDING } : r));
      setOutboxB(prev => [...prev, updateOutbox]);
      addLog('CLIENT_B', 'info', `[Optimistic UI] Mutated row '${recordId}' content offline.`);
      
      if (connectedB) {
        triggerSyncForClient('B', [updateOutbox]);
      } else {
        addLog('CLIENT_B', 'warn', `B is offline. Cached update transaction to localStorage outbox.`);
      }
    }
  };

  const handleDeleteRecord = (client: 'A' | 'B', recordId: string, collectionId: string) => {
    const timestamp = Date.now();
    
    const deleteOutbox: OutboxItem = {
      id: `tx_${client}_${Date.now()}`,
      operation: 'DELETE',
      collection: collectionId,
      documentId: recordId,
      payload: { id: recordId },
      timestamp,
      clientScopeId: `CLIENT_${client}`
    };

    if (client === 'A') {
      setClientADB(prev => prev.filter(r => r.id !== recordId));
      setOutboxA(prev => [...prev, deleteOutbox]);
      addLog('CLIENT_A', 'warn', `[Optimistic UI] Removed row '${recordId}' local index snapshot.`);
      
      if (connectedA) {
        triggerSyncForClient('A', [deleteOutbox]);
      }
    } else {
      setClientBDB(prev => prev.filter(r => r.id !== recordId));
      setOutboxB(prev => [...prev, deleteOutbox]);
      addLog('CLIENT_B', 'warn', `[Optimistic UI] Removed row '${recordId}' local index snapshot.`);
      
      if (connectedB) {
        triggerSyncForClient('B', [deleteOutbox]);
      }
    }
  };

  // ----------------------------------------------------------------
  // NETWORK & SYNC PROTOCOL
  // ----------------------------------------------------------------
  const handleToggleConnection = (client: 'A' | 'B') => {
    if (client === 'A') {
      const nextConn = !connectedA;
      setConnectedA(nextConn);
      addLog('CLIENT_A', nextConn ? 'success' : 'warn', `Client Alpha ${nextConn ? 'connected to sync network fiber.' : 'disconnected. Working fully offline.'}`);
      
      if (nextConn && outboxA.length > 0) {
        addLog('CLIENT_A', 'sync', `Alpha reconnected. ${outboxA.length} queued transactions found. Initializing sync heartbeat.`);
        triggerSyncForClient('A', outboxA);
      }
    } else {
      const nextConn = !connectedB;
      setConnectedB(nextConn);
      addLog('CLIENT_B', nextConn ? 'success' : 'warn', `Client Beta ${nextConn ? 'connected to sync network fiber.' : 'disconnected. Working fully offline.'}`);
      
      if (nextConn && outboxB.length > 0) {
        addLog('CLIENT_B', 'sync', `Beta reconnected. ${outboxB.length} queued transactions found. Initializing sync heartbeat.`);
        triggerSyncForClient('B', outboxB);
      }
    }
  };

  const triggerSyncForClient = (client: 'A' | 'B', txItems: OutboxItem[]) => {
    setIsSyncing(true);
    addLog('SERVER', 'info', `Sync heartbeat established with Client ${client}. Checking logical clocks...`);

    // Simulated network latency
    setTimeout(() => {
      // Find conflicts
      const discoveredConflicts = detectConflictingTransactions(serverDB, txItems, `CLIENT_${client}`);

      if (discoveredConflicts.length > 0) {
        addLog('SERVER', 'error', `[CONFLICT DETECTED] ${discoveredConflicts.length} item(s) violate single-write order. Halting automatic merge.`);
        setConflicts(prev => [...prev, ...discoveredConflicts]);
        setIsSyncing(false);
        return;
      }

      // No conflicts! Run sequential transactions commit
      let nextServer = [...serverDB];
      
      txItems.forEach(tx => {
        if (tx.operation === 'CREATE' || tx.operation === 'UPDATE') {
          const matchIdx = nextServer.findIndex(r => r.id === tx.documentId && r.collection === tx.collection);
          if (matchIdx !== -1) {
            // Update
            nextServer[matchIdx] = {
              id: tx.documentId,
              collection: tx.collection,
              data: { ...tx.payload },
              updatedAt: tx.timestamp,
              version: nextServer[matchIdx].version + 1,
              lastUpdatedBy: `CLIENT_${client}`
            };
          } else {
            // New row
            nextServer.push({
              id: tx.documentId,
              collection: tx.collection,
              data: { ...tx.payload },
              updatedAt: tx.timestamp,
              version: 1,
              lastUpdatedBy: `CLIENT_${client}`
            });
          }
        } else if (tx.operation === 'DELETE') {
          nextServer = nextServer.filter(r => !(r.id === tx.documentId && r.collection === tx.collection));
        }
      });

      setServerDB(nextServer);

      // Clean client outboxes and set status to synced
      if (client === 'A') {
        const processedDocIds = txItems.map(tx => tx.documentId);
        setClientADB(prev => prev.map(r => processedDocIds.includes(r.id) ? { ...r, syncStatus: SyncStatus.SYNCED } : r));
        setOutboxA(prev => prev.filter(item => !txItems.some(tx => tx.id === item.id)));
        addLog('CLIENT_A', 'success', `Outbox completely committed to central server ledge. Local indices set to SYNCED.`);
      } else {
        const processedDocIds = txItems.map(tx => tx.documentId);
        setClientBDB(prev => prev.map(r => processedDocIds.includes(r.id) ? { ...r, syncStatus: SyncStatus.SYNCED } : r));
        setOutboxB(prev => prev.filter(item => !txItems.some(tx => tx.id === item.id)));
        addLog('CLIENT_B', 'success', `Outbox completely committed to central server ledge. Local indices set to SYNCED.`);
      }

      setIsSyncing(false);
    }, syncSpeed === 'instant' ? 400 : 2000);
  };

  // Trigger global network reconciliation
  const reconcileAllConnectedClients = () => {
    if (connectedA && outboxA.length > 0) {
      triggerSyncForClient('A', outboxA);
    }
    if (connectedB && outboxB.length > 0) {
      triggerSyncForClient('B', outboxB);
    }
    if (outboxA.length === 0 && outboxB.length === 0) {
      addLog('SYSTEM', 'success', 'All local client queues matched with global ledger state.');
    }
  };

  // ----------------------------------------------------------------
  // MANUAL CONFLICT RESOLUTION METHODS
  // ----------------------------------------------------------------
  const resolveConflictWithStrategy = (
    conflict: SyncConflict,
    strategy: 'LWW' | 'CLIENT' | 'SERVER' | 'CRDT_UNION' | 'MANUAL',
    manualData?: any
  ) => {
    const { documentId, collection, serverVersion, clientVersion } = conflict;
    const clientScope = clientVersion.clientScopeId; // CLIENT_A or CLIENT_B
    const timestamp = Date.now();
    let resolvedData: any = {};

    addLog('SYSTEM', 'info', `Executing conflict resolution schema using strategy '${strategy}' on keys '${documentId}'...`);

    if (strategy === 'LWW') {
      // Last write wins
      if (clientVersion.updatedAt >= serverVersion.updatedAt) {
        resolvedData = { ...clientVersion.data };
        addLog('SERVER', 'success', `Resolution LWW complete: Client changes had newer clock (${new Date(clientVersion.updatedAt).toLocaleTimeString()}). Preserving Client state.`);
      } else {
        resolvedData = { ...serverVersion.data };
        addLog('SERVER', 'success', `Resolution LWW complete: Server state had newer clock. Reverting Client state.`);
      }
    } else if (strategy === 'CLIENT') {
      resolvedData = { ...clientVersion.data };
      addLog('SERVER', 'success', `Resolution rule CLIENT complete: Force override with incoming payload values.`);
    } else if (strategy === 'SERVER') {
      resolvedData = { ...serverVersion.data };
      addLog('SERVER', 'success', `Resolution rule SERVER complete: Discarding changes, server remains ultimate source of truth.`);
    } else if (strategy === 'CRDT_UNION') {
      // Merges any array properties using Set Union, and assigns key values
      resolvedData = { ...serverVersion.data };
      
      for (const [key, val] of Object.entries(clientVersion.data)) {
        if (Array.isArray(val) && Array.isArray(serverVersion.data[key])) {
          // Merge arrays (CRDT G-Set style)
          const mergedSet = Array.from(new Set([...val, ...serverVersion.data[key]]));
          resolvedData[key] = mergedSet;
        } else {
          // Fallback simple merge or client-side take
          resolvedData[key] = val;
        }
      }
      addLog('SERVER', 'success', `Resolution CRDT complete: Array properties merged mathematically via Set Union.`);
    } else if (strategy === 'MANUAL' && manualData) {
      resolvedData = { ...manualData };
      addLog('SERVER', 'success', `Manual merger complete: Exact chosen fields updated locally and on central ledger.`);
    }

    // Commit resolved version to server DB
    const finalPayload = encryptionEnabled ? encryptPayload(resolvedData, secretKey) : resolvedData;
    
    setServerDB(prev => prev.map(r => r.id === documentId && r.collection === collection 
      ? { ...r, data: finalPayload, updatedAt: timestamp, version: r.version + 1, lastUpdatedBy: 'CONFLICT_RESOLVER' } 
      : r
    ));

    // Align both Client DBs and clear Sync outboxes
    const unifiedClientRec: ClientRecord = {
      id: documentId,
      collection,
      data: finalPayload,
      updatedAt: timestamp,
      clientScopeId: clientScope,
      syncStatus: SyncStatus.SYNCED,
      version: serverVersion.version + 1
    };

    if (clientScope === 'CLIENT_A') {
      setClientADB(prev => prev.map(r => r.id === documentId ? unifiedClientRec : r));
      setOutboxA(prev => prev.filter(tx => tx.documentId !== documentId));
    } else {
      setClientBDB(prev => prev.map(r => r.id === documentId ? unifiedClientRec : r));
      setOutboxB(prev => prev.filter(tx => tx.documentId !== documentId));
    }

    // Secondary client pull state if online
    if (clientScope === 'CLIENT_A' && connectedB) {
      setClientBDB(prev => prev.map(r => r.id === documentId ? unifiedClientRec : r));
    } else if (clientScope === 'CLIENT_B' && connectedA) {
      setClientADB(prev => prev.map(r => r.id === documentId ? unifiedClientRec : r));
    }

    // Pop the resolved conflict out of active modal window array
    setConflicts(prev => prev.filter(c => !(c.documentId === documentId && c.collection === collection)));
  };

  // ----------------------------------------------------------------
  // SCHEMAS BUILDER DRIVERS
  // ----------------------------------------------------------------
  const handleAddSchema = (newSchema: SchemaDefinition) => {
    setSchemas(prev => [...prev, newSchema]);
    addLog('SYSTEM', 'success', `New relational schema designed: /collection/${newSchema.id}. Prepared table definition models.`);
  };

  const handleRemoveSchema = (schemaId: string) => {
    setSchemas(prev => prev.filter(s => s.id !== schemaId));
    addLog('SYSTEM', 'warn', `Schema definition model wiped: /collection/${schemaId}. Freeing browser memory spaces.`);
  };

  // ----------------------------------------------------------------
  // DATA ERASE & PRIVATE BACKUPS RESEGMENTATION
  // ----------------------------------------------------------------
  const handleClearStorage = (scope: 'CLIENT_A' | 'CLIENT_B' | 'SERVER') => {
    if (scope === 'CLIENT_A') {
      setClientADB([]);
      setOutboxA([]);
      addLog('CLIENT_A', 'warn', 'Local indexing records completely flushed.');
    } else if (scope === 'CLIENT_B') {
      setClientBDB([]);
      setOutboxB([]);
      addLog('CLIENT_B', 'warn', 'Local indexing records completely flushed.');
    } else {
      setServerDB([]);
      addLog('SERVER', 'error', 'WIPED CENTRAL LEDGER RECORD STORES. Virtual servers empty.');
    }
  };

  const handleRestoreBackup = (backupData: any) => {
    try {
      if (backupData.schemas) setSchemas(backupData.schemas);
      if (backupData.clientADB) setClientADB(backupData.clientADB);
      if (backupData.clientBDB) setClientBDB(backupData.clientBDB);
      if (backupData.serverDB) setServerDB(backupData.serverDB);
      if (typeof backupData.encryptionEnabled === 'boolean') setEncryptionEnabled(backupData.encryptionEnabled);
      if (backupData.secretKey) {
        setSecretKey(backupData.secretKey);
        addLog('SYSTEM', 'crypto', `Master symmetric storage key synchronized to backup: ${backupData.secretKey.substring(0,4)}****`);
      }
      addLog('SYSTEM', 'success', 'Local encrypted database backup restored successfully. Core caches recalculated.');
    } catch (e: any) {
      addLog('SYSTEM', 'error', `Failed to restore database backup: ${e.message}`);
    }
  };

  const handleFullReseedWipe = () => {
    localStorage.removeItem('hermit_schemas');
    localStorage.removeItem('hermit_server_db');
    localStorage.removeItem('hermit_client_a_db');
    localStorage.removeItem('hermit_client_b_db');
    localStorage.removeItem('hermit_outbox_a');
    localStorage.removeItem('hermit_outbox_b');

    const seed = getInitialRecords();
    setSchemas(DEFAULT_SCHEMAS);
    setServerDB(seed.server);
    setClientADB(seed.clientA);
    setClientBDB(seed.clientB);
    setOutboxA([]);
    setOutboxB([]);
    addLog('SYSTEM', 'success', 'All local client-side databases and server ledgers reseeded back to factory settings.');
  };

  const handleExportBackupJSON = () => {
    const backupObj = {
      exportedAt: new Date().toISOString(),
      schemas,
      serverDB,
      clientADB,
      clientBDB
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hermitdb_backup_${Date.now()}.json`;
    link.click();
    addLog('SYSTEM', 'success', 'JSON Backup package generated offline. File triggered.');
  };

  const handleExportBackupSQL = () => {
    const sql = generateSQLiteBackup(schemas, serverDB);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hermitdb_sqlite_backup_${Date.now()}.sql`;
    link.click();
    addLog('SYSTEM', 'success', 'SQL SQLite-Dump file generated successfully. Ready to run DDL structures.');
  };

  // Drag and drop parser to import backup files
  const handleImportFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        if (parsed.schemas && parsed.serverDB) {
          setSchemas(parsed.schemas);
          setServerDB(parsed.serverDB);
          if (parsed.clientADB) setClientADB(parsed.clientADB);
          if (parsed.clientBDB) setClientBDB(parsed.clientBDB);
          addLog('SYSTEM', 'success', `Data structures hydrated fully offline. Hydrated ${parsed.serverDB.length} central keys.`);
        } else {
          addLog('SYSTEM', 'error', 'Invalid file layout. Required schema definitions and server records.');
        }
      } catch {
        addLog('SYSTEM', 'error', 'Malformed backup file format. Must compile as clean JSON payloads.');
      }
    };
    reader.readAsText(file);
  };

  // ----------------------------------------------------------------
  // TERMINAL COMMAND EXECUTIVE INTERPRETER
  // ----------------------------------------------------------------
  const handleExecuteTerminalCommand = (rawCmd: string) => {
    const parts = rawCmd.trim().split(/\s+/);
    const action = parts[0].toLowerCase();
    
    addLog('SYSTEM', 'info', `hermitdb~$: ${rawCmd}`);

    switch (action) {
      case 'help':
        addLog('SYSTEM', 'info', 'Console Methods: [help, status, schemas, sync, wipe, force_reseed, encrypt]');
        addLog('SYSTEM', 'info', '  - help: Prints command guidelines.');
        addLog('SYSTEM', 'info', '  - status: Evaluates general network, key density, and byte specs.');
        addLog('SYSTEM', 'info', '  - schemas: Inspects custom table configurations.');
        addLog('SYSTEM', 'info', '  - sync: Reconciles all pending local mutations.');
        addLog('SYSTEM', 'info', '  - wipe: Clear all databases.');
        addLog('SYSTEM', 'info', '  - force_reseed: Returns workspace back to factory templates.');
        addLog('SYSTEM', 'info', '  - encrypt: Prints active PBKDF2 cryptography configurations.');
        break;

      case 'status':
        const bytesTotal = getByteSizeOfData(clientADB) + getByteSizeOfData(clientBDB) + getByteSizeOfData(serverDB);
        addLog('SYSTEM', 'success', `DB Status: ClientA connected: ${connectedA}, ClientB connected: ${connectedB}.`);
        addLog('SYSTEM', 'success', `Total payload byte ratio: ${bytesTotal} bytes.`);
        addLog('SYSTEM', 'success', `Records: Server: ${serverDB.length}, A: ${clientADB.length}, B: ${clientBDB.length}.`);
        break;

      case 'schemas':
        addLog('SYSTEM', 'info', `Active Schema Configurations (${schemas.length} found):`);
        schemas.forEach(s => {
          addLog('SYSTEM', 'info', `  /${s.id} -> ${s.name} (${s.fields.length} properties)`);
        });
        break;

      case 'sync':
        reconcileAllConnectedClients();
        break;

      case 'wipe':
        setClientADB([]);
        setClientBDB([]);
        setServerDB([]);
        setOutboxA([]);
        setOutboxB([]);
        addLog('SYSTEM', 'warn', 'Diagnostics logs & data buffers completely cleared.');
        break;

      case 'force_reseed':
        handleFullReseedWipe();
        break;

      case 'encrypt':
        addLog('SYSTEM', 'crypto', `Zero-knowledge Crypt State: Encryption Active: ${encryptionEnabled}`);
        addLog('SYSTEM', 'crypto', `Token salt target: ${secretKey}`);
        break;

      default:
        addLog('SYSTEM', 'error', `Unrecognized command: '${action}'. Type 'help' to review guidelines.`);
    }
  };

  // ----------------------------------------------------------------
  // MAIN DRAW RENDER
  // ----------------------------------------------------------------
  return (
    <div className="bg-[#0A0B14] text-slate-200 min-h-screen flex flex-col font-sans text-sm antialiased pb-12 relative overflow-hidden selection:bg-blue-500 selection:text-white">
      
      {/* Mesh Gradient Background Decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="absolute top-[30%] left-[30%] w-[30%] h-[30%] bg-pink-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Top Professional Tech Banner Header */}
      <header className="relative z-40 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-black/10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/15 p-2.5 rounded-xl border border-blue-400/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <FolderSync className="w-6 h-6 text-blue-400 rotate-180 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-wider uppercase font-mono">HermitDB</h1>
              <span className="text-[9px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider animate-pulse">
                v1.0.4-offline
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans tracking-wide">
              Zero-Trust Local-First Simulator & Diagnostic Workspace
            </p>
          </div>
        </div>

        {/* Global Statistics Modules */}
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-400">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Total Sandboxed Memory: <span className="text-white font-bold">{getByteSizeOfData(clientADB) + getByteSizeOfData(clientBDB) + getByteSizeOfData(serverDB)} B</span>
          </div>
          
          <div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${encryptionEnabled ? 'bg-fuchsia-400 animate-pulse' : 'bg-rose-500'}`}></span>
            E2EE Client Privacy: <span className={`${encryptionEnabled ? 'text-fuchsia-400' : 'text-rose-400'} font-bold`}>
              {encryptionEnabled ? 'ACTIVE (PBKDF2)' : 'DISABLED'}
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <RefreshIcon className="w-3 h-3 text-emerald-400 animate-spin-slow" />
            Queued Transactions: <span className="text-white font-bold">{outboxA.length + outboxB.length}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-4 md:p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column splits - primary workspaces & tabs (colSpan 8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Visual tab control switches bar */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl gap-1 backdrop-blur-md">
            <button
              type="button"
              id="tab-btn-workspace"
              onClick={() => setActiveTab('workspace')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                activeTab === 'workspace'
                  ? 'bg-white/10 border border-white/10 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-250 hover:bg-white/5 border border-transparent'
              }`}
            >
              <FolderSync className="w-4 h-4" /> Device Playground
            </button>
            <button
              type="button"
              id="tab-btn-schemas"
              onClick={() => setActiveTab('schemas')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                activeTab === 'schemas'
                  ? 'bg-white/10 border border-white/10 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-250 hover:bg-white/5 border border-transparent'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Schema Architect
            </button>
            <button
              type="button"
              id="tab-btn-inspector"
              onClick={() => setActiveTab('inspector')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                activeTab === 'inspector'
                  ? 'bg-white/10 border border-white/10 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-250 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Server className="w-4 h-4" /> Storage Inspector
            </button>
            <button
              type="button"
              id="tab-btn-security"
              onClick={() => setActiveTab('security')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                activeTab === 'security'
                  ? 'bg-white/10 border border-white/10 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-250 hover:bg-white/5 border border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Zero-Knowledge
            </button>
            <button
              type="button"
              id="tab-btn-blueprint"
              onClick={() => setActiveTab('blueprint')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                activeTab === 'blueprint'
                  ? 'bg-white/10 border border-white/10 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-250 hover:bg-white/5 border border-transparent'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Local-First Guide
            </button>
          </div>

          {/* Active Work Panel drawing switchboard */}
          {activeTab === 'workspace' && (
            <Workspace
              schemas={schemas}
              clientA={clientADB}
              clientB={clientBDB}
              outboxA={outboxA}
              outboxB={outboxB}
              connectedA={connectedA}
              connectedB={connectedB}
              onToggleConnection={handleToggleConnection}
              onAddRecord={handleAddRecord}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              encryptionEnabled={encryptionEnabled}
              secretKey={secretKey}
              onUpdateSecretKey={(val) => {
                setSecretKey(val);
                addLog('SYSTEM', 'crypto', `Master secret key reset via seed phrase recovery. Symmetrical storage keys re-derived.`);
              }}
              recoveryPhrase={recoveryPhrase}
              setRecoveryPhrase={setRecoveryPhrase}
              addLog={addLog}
            />
          )}

          {activeTab === 'schemas' && (
            <SchemaBuilder
              schemas={schemas}
              onAddSchema={handleAddSchema}
              onRemoveSchema={handleRemoveSchema}
            />
          )}

          {activeTab === 'inspector' && (
            <StorageInspector
              schemas={schemas}
              clientA={clientADB}
              clientB={clientBDB}
              server={serverDB}
              encryptionEnabled={encryptionEnabled}
              onClearStorage={handleClearStorage}
              onRestoreBackup={handleRestoreBackup}
              addLog={addLog}
            />
          )}

          {activeTab === 'security' && (
            <CryptModule
              encryptionEnabled={encryptionEnabled}
              onToggleEncryption={(val) => {
                setEncryptionEnabled(val);
                addLog('SYSTEM', 'crypto', `Client encryption flag toggled to ${val}.`);
              }}
              secretKey={secretKey}
              onUpdateSecretKey={(val) => {
                setSecretKey(val);
                addLog('SYSTEM', 'crypto', `Virtual symmetric key shifted. Regulating cipher matrices.`);
              }}
              recoveryPhrase={recoveryPhrase}
              setRecoveryPhrase={(val) => setRecoveryPhrase(val)}
              recoveryVerified={recoveryVerified}
              onSetRecoveryVerified={setRecoveryVerified}
              addLog={addLog}
            />
          )}

          {activeTab === 'blueprint' && (
            <div id="local-first-educational-grid" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl relative z-10 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-sans">
                  Local-First Core Architectural Blueprint
                </h3>
              </div>
              <p className="text-xs text-slate-350 font-sans leading-relaxed">
                Local-first is a modern software design paradigm that prioritizes offline usability, zero-lag interactions, and cryptographic user privacy. Applications run fully inside sandboxed user runtimes without expecting continuous backend API connectivity.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-black/20 backdrop-blur-lg border border-white/5 p-4 rounded-2xl space-y-2 hover:border-blue-500/20 transition-colors">
                  <div className="text-[10px] uppercase text-blue-400 font-black tracking-widest font-mono">Layer 1</div>
                  <span className="text-xs font-bold text-white block">Opt_UI Layer</span>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Updates visual layers in real-time, completely bypassing network roundtrip barriers to grant instant user feedback loops.
                  </p>
                </div>
                <div className="bg-black/20 backdrop-blur-lg border border-white/5 p-4 rounded-2xl space-y-2 hover:border-purple-500/20 transition-colors">
                  <div className="text-[10px] uppercase text-purple-400 font-black tracking-widest font-mono">Layer 2</div>
                  <span className="text-xs font-bold text-white block">Local Indexes</span>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Handles queries and persistent commits directly on device structures (SQLite-WASM, IDB, LocalStorage) with zero network hops.
                  </p>
                </div>
                <div className="bg-black/20 backdrop-blur-lg border border-white/5 p-4 rounded-2xl space-y-2 hover:border-amber-500/20 transition-colors">
                  <div className="text-[10px] uppercase text-amber-400 font-black tracking-widest font-mono">Layer 3</div>
                  <span className="text-xs font-bold text-white block">Tx Queue</span>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Buffers write orders and mutations inside a persistent outbound sync log, preserving logical operation order during offline stretches.
                  </p>
                </div>
                <div className="bg-black/20 backdrop-blur-lg border border-white/5 p-4 rounded-2xl space-y-2 hover:border-rose-505/20 transition-colors">
                  <div className="text-[10px] uppercase text-rose-450 font-black tracking-widest font-mono">Layer 4</div>
                  <span className="text-xs font-bold text-white block">Sync Engine</span>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Processes transaction log frames up-stream incrementally, managing hybrid logical clocks and network state transitions.
                  </p>
                </div>
                <div className="bg-black/20 backdrop-blur-lg border border-white/5 p-4 rounded-2xl space-y-2 hover:border-emerald-500/20 transition-colors">
                  <div className="text-[10px] uppercase text-emerald-400 font-black tracking-widest font-mono">Layer 5</div>
                  <span className="text-xs font-bold text-white block">State Merger</span>
                  <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                    Recharges data state cleanly using Last-Write-Wins epochs, custom CRDT unions, or interactive manual conflict wizards.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostics console terminal */}
          <Terminal 
            logs={logs}
            onClearLogs={handleClearLogs}
            onExecuteCommand={handleExecuteTerminalCommand}
          />
        </div>

        {/* Right column (colSpan 4): Server Ledger Sync feeds & Conflict resolution wizards */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Central Cloud Server State */}
          <div id="central-cloud-ledger-panel" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative z-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-450 animate-pulse" />
                <div>
                  <h3 className="text-xs font-bold tracking-wider text-white uppercase font-sans">
                    Central Server Ledger
                  </h3>
                  <span className="text-[9px] text-slate-400 block font-mono">Simulated Cloud Truth Database</span>
                </div>
              </div>

              {/* Master Sync Trigger Button */}
              <button
                type="button"
                id="manual-reconcile-all-btn"
                onClick={reconcileAllConnectedClients}
                disabled={isSyncing}
                className="text-xs bg-white/10 hover:bg-white/15 text-emerald-400 border border-white/10 hover:border-white/20 px-3.5 py-2 rounded-xl font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} /> Sync All
              </button>
            </div>

            {/* Simulated Server Database Records List */}
            <div className="bg-black/20 backdrop-blur-md p-3.5 rounded-2xl border border-white/5 h-[220px] overflow-y-auto font-mono text-xs space-y-2.5">
              <span className="text-[9px] uppercase font-mono font-bold tracking-widest text-slate-500 border-b border-white/5 pb-1.5 block">
                Committed Main Branch Keys ({serverDB.length} rows)
              </span>

              {serverDB.length === 0 ? (
                <div className="h-[140px] flex items-center justify-center text-slate-500 uppercase italic text-[11px]">
                  No Records on Cloud Ledger
                </div>
              ) : (
                serverDB.map((sRec) => (
                  <div key={sRec.id} className="p-3 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/10 transition-all duration-200">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/5 pb-1 mb-1.5 bg-black/25 px-1.5 py-1 rounded-lg">
                      <span className="font-bold text-slate-355">ID: <span className="text-emerald-400">{sRec.id}</span></span>
                      <span>v{sRec.version}</span>
                    </div>
                    {/* Compact property listings */}
                    <div className="text-[10px] text-slate-300 pl-1 leading-normal truncate">
                      {Object.entries(sRec.data)
                        .filter(([k]) => k !== 'id')
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`)
                        .join(' | ')}
                    </div>
                    <div className="text-[8px] text-slate-500 text-right font-semibold uppercase tracking-wider mt-1.5 block">
                      BY: {sRec.lastUpdatedBy === 'SERVER_BOOT' ? 'Init Seed' : sRec.lastUpdatedBy}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Step-by-Step Conflict Resolution Interactive Wizard */}
          {conflicts.length > 0 && (
            <div id="conflict-resolution-wizard" className="bg-rose-950/20 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-6 space-y-4 shadow-2xl relative z-10 hover:border-rose-500/40 transition-all duration-200">
              <div className="flex items-center gap-2 border-b border-rose-500/20 pb-3">
                <AlertTriangle className="w-5 h-5 text-rose-450 animate-bounce" />
                <div>
                  <h3 className="text-xs font-bold tracking-wider text-rose-300 uppercase font-sans">
                    Conflict Resolution Wizard
                  </h3>
                  <span className="text-[9px] text-rose-400 block font-semibold leading-none font-mono">
                    COLLISION DETECTED DURING RECONCILIATION
                  </span>
                </div>
              </div>

              {/* Loop and list conflicts */}
              <div className="space-y-4">
                {conflicts.map((con, idx) => (
                  <div key={con.documentId + idx} className="bg-black/35 backdrop-blur-md border border-white/5 p-4 rounded-2xl space-y-4 select-text">
                    <div className="space-y-0.5 border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-white uppercase block">
                        Document Collision: <span className="text-rose-400">{con.documentId}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">Collection Path: /{con.collection}</span>
                    </div>

                    {/* Side-by-Side Values Comparison Diffs mapping */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/20 border border-white/5 p-2.5 rounded-xl text-[11px] leading-relaxed">
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded font-mono uppercase block mb-1.5 text-center">
                          Server State
                        </span>
                        <div className="max-h-[100px] overflow-y-auto space-y-0.5 font-mono">
                          {Object.entries(con.serverVersion.data)
                            .filter(([key]) => con.conflictingFields.includes(key))
                            .map(([key, val]) => (
                              <div key={key}>
                                <span className="text-slate-500 font-bold">{key}:</span>{' '}
                                <span className="text-slate-300 font-bold">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="bg-black/20 border border-rose-500/10 p-2.5 rounded-xl text-[11px] leading-relaxed">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase block mb-1.5 text-center ${
                          con.clientVersion.clientScopeId === 'CLIENT_A' ? 'text-blue-400 bg-blue-950/50' : 'text-purple-400 bg-purple-950/50'
                        }`}>
                          {con.clientVersion.clientScopeId === 'CLIENT_A' ? 'Client Alpha' : 'Client Beta'}
                        </span>
                        <div className="max-h-[100px] overflow-y-auto space-y-0.5 font-mono">
                          {Object.entries(con.clientVersion.data)
                            .filter(([key]) => con.conflictingFields.includes(key))
                            .map(([key, val]) => (
                              <div key={key}>
                                <span className="text-slate-500 font-bold">{key}:</span>{' '}
                                <span className="text-rose-400 font-bold">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Strategy Button Arrays */}
                    <div className="space-y-1.5 pt-2.5 border-t border-white/10">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold block mb-1">
                        Select Resolve Strategy
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          id={`resolve-lww-btn-${idx}`}
                          onClick={() => resolveConflictWithStrategy(con, 'LWW')}
                          className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 hover:border-white/10 py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold uppercase transition"
                          title="Apply system LWW timestamps logic"
                        >
                          Last-Write-Wins
                        </button>
                        <button
                          type="button"
                          id={`resolve-client-btn-${idx}`}
                          onClick={() => resolveConflictWithStrategy(con, 'CLIENT')}
                          className="bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 border border-blue-500/10 py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold uppercase transition"
                        >
                          Accept Client
                        </button>
                        <button
                          type="button"
                          id={`resolve-server-btn-${idx}`}
                          onClick={() => resolveConflictWithStrategy(con, 'SERVER')}
                          className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold uppercase transition"
                        >
                          Keep Server
                        </button>
                        <button
                          type="button"
                          id={`resolve-crdt-btn-${idx}`}
                          onClick={() => resolveConflictWithStrategy(con, 'CRDT_UNION')}
                          className="bg-purple-500/10 hover:bg-purple-500/15 text-purple-400 border border-purple-500/10 py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold uppercase transition"
                        >
                          CRDT G-Set Union
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portability / Export - Import Panel Section */}
          <div id="data-portability-panel" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl relative z-10">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Download className="w-5 h-5 text-blue-400 animate-bounce" />
              <div>
                <h3 className="text-xs font-bold tracking-wider text-white uppercase font-sans">
                  Export & Portability Suite
                </h3>
                <span className="text-[9px] text-slate-400 block font-mono">Manage localized sandboxed payloads offline</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Export Triggers */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="export-json-btn"
                  onClick={handleExportBackupJSON}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 py-2.5 px-3 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Dump JSON
                </button>
                <button
                  type="button"
                  id="export-sql-btn"
                  onClick={handleExportBackupSQL}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 py-2.5 px-3 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Dump SQL
                </button>
              </div>

              {/* Import Upload */}
              <div className="bg-black/25 p-4 rounded-2xl border border-white/5 text-center relative hover:bg-black/35 transition cursor-pointer">
                <input
                  id="import-backup-file-input"
                  type="file"
                  accept=".json"
                  onChange={handleImportFileDrop}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  title="Import JSON Backup file"
                />
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-300 uppercase block font-sans">Hydrate JSON Backup</span>
                <span className="text-[8px] text-slate-500 uppercase font-mono block mt-0.5">Click or drag file here</span>
              </div>

              <button
                type="button"
                id="factory-reseed-btn"
                onClick={handleFullReseedWipe}
                className="w-full bg-red-500/10 hover:bg-red-500/15 text-red-400 hover:text-red-300 border border-red-500/20 font-mono font-bold text-[10px] uppercase tracking-widest py-2 rounded-xl transition"
              >
                Factory Reseed Store
              </button>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
