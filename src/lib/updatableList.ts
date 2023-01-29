import List from 'list.js';

/**
 * Keep the state of the table even after update() is executed
 *
 * @param {string | HTMLElement} element id of the list area
 * @param {{regex, searchFunction}} apmCustomSearch add different search methods
 * @param {RegExp} apmCustomSearch.regex condition for activating the search method
 * @param {(items:{values: (newValues?: object) => object, found?: boolean}[], searchString: string) => void} apmCustomSearch.searchFunction function passed to List.search()
 * @param {List.ListOptions} options option parameters
 * @param {object[]} values values to add to the list
 * @returns {List} List.js List
 */
function createList(
  element: string | HTMLElement,
  apmCustomSearch: {
    regex: RegExp;
    searchFunction: (
      items: { values: (newValues?: object) => object; found?: boolean }[],
      searchString: string
    ) => void;
  },
  options?: List.ListOptions,
  values?: object[]
): List {
  const searchBox = document.getElementsByClassName(
    'fuzzy-search-wrapped'
  )?.[0] as HTMLInputElement;

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
  prepareSortState();

  updatableList.filter = (filterFunction: (item: List.ListItem) => boolean) => {
    updatableList.filterFunction = filterFunction;
    parentList.filter(filterFunction);
  };

  const doSearch = (target: HTMLInputElement) => {
    const searchString = target.value.trim();
    apmCustomSearch.regex.test(searchString)
      ? parentList.search(searchString, ((tempStr: string) =>
          apmCustomSearch.searchFunction(
            parentList.items as { values: () => object }[],
            tempStr
          )) as never)
      : parentList.fuzzySearch(searchString);
  };
  searchBox.addEventListener('input', () => doSearch(searchBox));

  updatableList.update = () => {
    parentList.update();

    updatableList.filterFunction &&
      parentList.filter(updatableList.filterFunction);

    searchBox.value && doSearch(searchBox);

    updatableList.sortState &&
      parentList.sort(
        updatableList.sortState.value,
        updatableList.sortState.options
      );
  };
  updatableList.update();

  return updatableList;
}

export default createList;
