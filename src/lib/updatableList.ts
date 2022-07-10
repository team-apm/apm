import List from 'list.js';

/**
 * Keep the state of the table even after update() is executed
 *
 * @param {string | HTMLElement} element id of the list area
 * @param {List.ListOptions} options option parameters
 * @param {object[]} values values to add to the list
 * @returns {List} List.js List
 */
function createList(
  element: string | HTMLElement,
  options?: List.ListOptions,
  values?: object[]
): List {
  const parentList = new List(element, options, values);
  const updatableList = Object.create(parentList);

  const prepareSortState = () => {
    const sortAsc = Array.from(
      document.getElementsByClassName(
        'sort asc'
      ) as HTMLCollectionOf<HTMLDivElement>
    );
    const sortDesc = Array.from(
      document.getElementsByClassName(
        'sort desc'
      ) as HTMLCollectionOf<HTMLDivElement>
    );
    if (sortAsc.length !== 0)
      updatableList.sortState = {
        value: sortAsc[0].dataset.sort,
        options: { order: 'asc' },
      };
    if (sortDesc.length !== 0)
      updatableList.sortState = {
        value: sortDesc[0].dataset.sort,
        options: { order: 'desc' },
      };
  };

  parentList.on('sortComplete', prepareSortState);

  updatableList.filter = (filterFunction: (item: List.ListItem) => boolean) => {
    updatableList.filterFunction = filterFunction;
    parentList.filter(filterFunction);
  };

  updatableList.update = () => {
    parentList.update();

    updatableList.filterFunction &&
      parentList.filter(updatableList.filterFunction);

    const searchString = (
      document.getElementsByClassName('fuzzy-search')?.[0] as HTMLInputElement
    ).value;
    searchString && parentList.fuzzySearch(searchString);

    updatableList.sortState &&
      parentList.sort(
        updatableList.sortState.value,
        updatableList.sortState.options
      );
  };

  prepareSortState();
  updatableList.update();

  return updatableList;
}

export default createList;
