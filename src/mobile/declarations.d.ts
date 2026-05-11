declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    transaction(callback: (tx: any) => void): Promise<void>;
    executeSql(sqlStatement: string, params?: any[]): Promise<[any]>;
  }
  export function openDatabase(params: { name: string; location: string }): Promise<SQLiteDatabase>;
  export function enablePromise(enable: boolean): void;
}
