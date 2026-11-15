// Just what lib/data-mode.ts uses (copying the database with SQLite's online
// backup). better-sqlite3 ships no types and @types/better-sqlite3 isn't installed.
declare module "better-sqlite3" {
  export default class Database {
    constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean });
    backup(destination: string): Promise<unknown>;
    close(): void;
  }
}
