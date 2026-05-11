export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  CONFLICT = 'CONFLICT',
}

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  defaultValue?: any;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
}

export interface RecordData {
  id: string;
  [key: string]: any;
}

export interface ClientRecord {
  id: string;
  collection: string;
  data: RecordData;
  updatedAt: number;
  clientScopeId: string;
  syncStatus: SyncStatus;
  version: number;
}

export interface ServerRecord {
  id: string;
  collection: string;
  data: RecordData;
  updatedAt: number;
  version: number;
  lastUpdatedBy: string;
}

export interface OutboxItem {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  documentId: string;
  payload: RecordData;
  timestamp: number;
  clientScopeId: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warn' | 'error' | 'crypto' | 'sync';
  source: 'SYSTEM' | 'CLIENT_A' | 'CLIENT_B' | 'SERVER';
  message: string;
}

export interface SyncConflict {
  documentId: string;
  collection: string;
  serverVersion: ServerRecord;
  clientVersion: ClientRecord;
  conflictingFields: string[];
}
