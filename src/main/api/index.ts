import { appProcedures } from './app';
import { coreRouter } from './core';
import { migrationRouter } from './migration';
import { modListRouter } from './modList';
import { nicommonsRouter } from './nicommons';
import { packagesRouter } from './packages';
import { settingsRouter } from './settings';
import { t } from './trpc';

export { createContext, type Context } from './trpc';

export const router = t.router({
  ...appProcedures,
  settings: settingsRouter,
  modList: modListRouter,
  packages: packagesRouter,
  nicommons: nicommonsRouter,
  migration: migrationRouter,
  core: coreRouter,
});

export type AppRouter = typeof router;
