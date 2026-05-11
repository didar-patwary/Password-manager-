import { 
  SchemaDefinition, 
  ClientRecord, 
  ServerRecord, 
  OutboxItem, 
  SyncStatus, 
  SyncConflict 
} from '../types';

// Predefined default schemas
export const DEFAULT_SCHEMAS: SchemaDefinition[] = [
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'Track developer workflows and project deadlines offline.',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'status', type: 'string', required: true, defaultValue: 'Backlog' },
      { name: 'priority', type: 'string', required: true, defaultValue: 'Medium' },
      { name: 'assignee', type: 'string', required: false, defaultValue: 'Unassigned' },
    ]
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Keep quick ideas, brain dumps, and markdown snippets.',
    fields: [
      { name: 'caption', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
      { name: 'tags', type: 'array', required: false, defaultValue: [] },
    ]
  },
  {
    id: 'contacts',
    name: 'Contacts',
    description: 'Maintain network directories and touchpoints.',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'phone', type: 'string', required: false },
    ]
  }
];

// Mock data generator for initial state
export const getInitialRecords = (): { server: ServerRecord[], clientA: ClientRecord[], clientB: ClientRecord[] } => {
  const serverInitial: ServerRecord[] = [
    {
      id: 'task_1',
      collection: 'tasks',
      data: { id: 'task_1', title: 'Implement local state DB', status: 'In Progress', priority: 'High', assignee: 'Alice' },
      updatedAt: Date.now() - 3600000,
      version: 1,
      lastUpdatedBy: 'SERVER_BOOT'
    },
    {
      id: 'task_2',
      collection: 'tasks',
      data: { id: 'task_2', title: 'Define offline conflict policy', status: 'Backlog', priority: 'Low', assignee: 'Unassigned' },
      updatedAt: Date.now() - 7200000,
      version: 1,
      lastUpdatedBy: 'SERVER_BOOT'
    },
    {
      id: 'note_1',
      collection: 'notes',
      data: { id: 'note_1', caption: 'LoomDB Stack', content: 'Vite + React + LocalStorage + WebCrypto Encryption', tags: ['local-first', 'tech-stack'] },
      updatedAt: Date.now() - 1800000,
      version: 1,
      lastUpdatedBy: 'SERVER_BOOT'
    },
    {
      id: 'contact_1',
      collection: 'contacts',
      data: { id: 'contact_1', name: 'John Doe', email: 'john@hermitdb.org', phone: '+1 (555) 0199' },
      updatedAt: Date.now() - 5400000,
      version: 1,
      lastUpdatedBy: 'SERVER_BOOT'
    }
  ];

  // Deep clone for clients
  const clientA: ClientRecord[] = serverInitial.map(item => ({
    id: item.id,
    collection: item.collection,
    data: { ...item.data },
    updatedAt: item.updatedAt,
    clientScopeId: 'CLIENT_A',
    syncStatus: SyncStatus.SYNCED,
    version: item.version
  }));

  const clientB: ClientRecord[] = serverInitial.map(item => ({
    id: item.id,
    collection: item.collection,
    data: { ...item.data },
    updatedAt: item.updatedAt,
    clientScopeId: 'CLIENT_B',
    syncStatus: SyncStatus.SYNCED,
    version: item.version
  }));

  return { server: serverInitial, clientA, clientB };
};

// Compute visual byte size
export const getByteSizeOfData = (obj: any): number => {
  try {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  } catch {
    return 0;
  }
};

// Visual deterministic encryption (retains readability of structures while masking actual cell content)
// In a production app, real crypto uses WebCrypto Subtitle keys. This simulation lets you set keys, and outputs AES-looking hashed strings.
export const encryptPayload = (payload: any, secretKey: string): any => {
  if (!secretKey) return payload;
  const encrypted: any = {};
  
  // Custom deterministic shift-cipher to render real visual ciphertext
  const shiftText = (text: string, key: string): string => {
    const keySum = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const masked = text.split('').map((char) => {
      const code = char.charCodeAt(0);
      // Simple offset within readable characters (32 to 126)
      if (code >= 32 && code <= 126) {
        return String.fromCharCode(((code - 32 + (keySum % 95)) % 95) + 32);
      }
      return char;
    }).join('');
    // Wrap to look like standard secure crypt
    const hash = btoa(masked).substring(0, 15);
    return `§ENC[AES-256_PBKDF2]::${hash}§`;
  };

  for (const [key, val] of Object.entries(payload)) {
    if (key === 'id') {
      encrypted[key] = val; // Keep ID plaintext for indexing
    } else if (typeof val === 'string') {
      encrypted[key] = shiftText(val, secretKey);
    } else if (typeof val === 'number') {
      encrypted[key] = shiftText(val.toString(), secretKey);
    } else if (typeof val === 'boolean') {
      encrypted[key] = shiftText(val ? 'true' : 'false', secretKey);
    } else if (Array.isArray(val)) {
      encrypted[key] = val.map(item => typeof item === 'string' ? shiftText(item, secretKey) : item);
    } else {
      encrypted[key] = val;
    }
  }
  return encrypted;
};

export const decryptString = (encryptedText: string, secretKey: string): string => {
  if (!encryptedText || !encryptedText.startsWith('§ENC[')) return encryptedText;
  try {
    const parts = encryptedText.split('::');
    if (parts.length < 2) return encryptedText;
    const cryptHash = parts[1].replace(/§/g, '');
    const decoded = atob(cryptHash);
    
    const keySum = secretKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return decoded.split('').map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 32 && code <= 126) {
        let original = (code - 32 - (keySum % 95)) % 95;
        if (original < 0) original += 95;
        return String.fromCharCode(original + 32);
      }
      return char;
    }).join('');
  } catch {
    return 'Decryption Error (Incorrect Key)';
  }
};

// Export to SQL structures completely offline
export const generateSQLiteBackup = (
  schemas: SchemaDefinition[],
  serverRecords: ServerRecord[]
): string => {
  let sql = `-- HermitDB SQL Export Dump --\n`;
  sql += `-- Generated offline on ${new Date().toISOString()}\n`;
  sql += `-- SQLite Dialect Compatible\n\n`;

  schemas.forEach(schema => {
    sql += `CREATE TABLE IF NOT EXISTS \`${schema.id}\` (\n`;
    sql += `  \`id\` TEXT PRIMARY KEY,\n`;
    
    schema.fields.forEach(field => {
      let sqlType = 'TEXT';
      if (field.type === 'number') sqlType = 'NUMERIC';
      if (field.type === 'boolean') sqlType = 'INTEGER';
      sql += `  \`${field.name}\` ${sqlType}${field.required ? ' NOT NULL' : ''},\n`;
    });
    
    sql += `  \`version\` INTEGER DEFAULT 1,\n`;
    sql += `  \`updated_at\` INTEGER\n`;
    sql += `);\n\n`;

    // Extract records of this collection
    const records = serverRecords.filter(r => r.collection === schema.id);
    if (records.length > 0) {
      records.forEach(rec => {
        const columns = ['id', ...schema.fields.map(f => f.name), 'version', 'updated_at'];
        const values = columns.map(col => {
          if (col === 'version') return rec.version;
          if (col === 'updated_at') return rec.updatedAt;
          
          const val = rec.data[col];
          if (val === undefined || val === null) return 'NULL';
          if (typeof val === 'boolean') return val ? 1 : 0;
          if (typeof val === 'number') return val;
          if (Array.isArray(val)) return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        
        sql += `INSERT OR REPLACE INTO \`${schema.id}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
      });
      sql += '\n';
    }
  });

  return sql;
};

// Simulated Sync Logic with Conflicts Finder
export const detectConflictingTransactions = (
  serverRecords: ServerRecord[],
  queuedItems: OutboxItem[],
  clientScope: string
): SyncConflict[] => {
  const conflicts: SyncConflict[] = [];

  queuedItems.forEach(tx => {
    const serverMatch = serverRecords.find(item => item.collection === tx.collection && item.id === tx.documentId);
    
    // If a server version exists and was updated since the transaction pulled it, we examine conflicts
    if (serverMatch) {
      // If there are separate modifications
      const changedKeys = Object.keys(tx.payload).filter(k => k !== 'id');
      const serverData = serverMatch.data;
      
      const distinctServerChanges = changedKeys.some(key => {
        const valClient = tx.payload[key];
        const valServer = serverData[key];
        
        if (Array.isArray(valClient) && Array.isArray(valServer)) {
          return JSON.stringify(valClient) !== JSON.stringify(valServer);
        }
        return valClient !== valServer;
      });

      if (distinctServerChanges && serverMatch.lastUpdatedBy !== clientScope) {
        // Find conflicting fields
        const conflictingFields = changedKeys.filter(key => {
          const valClient = tx.payload[key];
          const valServer = serverData[key];
          if (Array.isArray(valClient) && Array.isArray(valServer)) {
            return JSON.stringify(valClient) !== JSON.stringify(valServer);
          }
          return valClient !== valServer;
        });

        if (conflictingFields.length > 0) {
          // Put together mock ClientRecord representation
          const clientRec: ClientRecord = {
            id: tx.documentId,
            collection: tx.collection,
            data: { ...tx.payload },
            updatedAt: tx.timestamp,
            clientScopeId: clientScope,
            syncStatus: SyncStatus.CONFLICT,
            version: serverMatch.version // Baseline assumed
          };

          conflicts.push({
            documentId: tx.documentId,
            collection: tx.collection,
            serverVersion: serverMatch,
            clientVersion: clientRec,
            conflictingFields
          });
        }
      }
    }
  });

  return conflicts;
};
