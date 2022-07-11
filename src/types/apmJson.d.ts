export type ApmJsonObject = {
  dataVersion: string;
  core: { aviutl?: string; exedit?: string };
  packages: { [id: string]: { id: string; version: string } };
  convertMod?: number;
};
