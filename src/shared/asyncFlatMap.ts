// https://zenn.dev/repomn/scraps/d80ccd5c9183f0
/**
 * Maps each item with an async callback and flattens the results by one level.
 * @param {Item[]} arr - The array to map.
 * @param {(value: Item, index: number, array: Item[]) => Promise<Res>} callback - An async mapper whose result is flattened.
 * @returns {Promise<unknown[]>} The flattened results.
 */
export async function asyncFlatMap<Item, Res>(
  arr: Item[],
  callback: (value: Item, index: number, array: Item[]) => Promise<Res>,
) {
  const a = await Promise.all(arr.map(callback));
  return a.flat();
}
