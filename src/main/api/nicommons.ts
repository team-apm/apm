import { getNicommonsData } from '../services/nicommons';
import { procedure, stringInput, t } from './trpc';

export const nicommonsRouter = t.router({
  getData: procedure
    .input(stringInput)
    .query(async ({ input }) => await getNicommonsData(input)),
});
