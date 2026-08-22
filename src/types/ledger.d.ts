export type LedgerObject = {
  dataVersion: string;
  core: { aviutl?: string; exedit?: string };
  packages: { [id: string]: { id: string; version: string } };
  convertMod?: number;
};
