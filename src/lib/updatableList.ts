import List from 'list.js';

interface ListItemMaybeFound extends List.ListItem {
  found?: boolean;
}
export interface UpdatableList extends List {
  sortState: {
    value: string;
    options: { order: string };
  };
  filterFunction: (item: List.ListItem) => boolean;
  searchFunction: (
    items: ListItemMaybeFound[],
    searchString: string
  ) => Promise<string>;
  update: (searchFunction?: UpdatableList['searchFunction']) => void;
}

/**
 * Keep the state of the table even after update() is executed
 *
 * @param {string | HTMLElement} element id of the list area
 * @param {{regex, searchFunction}} apmCustomSearch add different search methods
 * @param {RegExp} apmCustomSearch.regex condition for activating the search method
 * @param {UpdatableList['searchFunction']} apmCustomSearch.searchFunction synchronously set `found` flag on the items, then return the string asynchronously.
 * @param {List.ListOptions} options option parameters
 * @param {object[]} values values to add to the list
 * @returns {List} List.js List
 */
function createList(
  element: string | HTMLElement,
  apmCustomSearch: {
    regex: RegExp;
    searchFunction: UpdatableList['searchFunction'];
  },
  options?: List.ListOptions,
  values?: object[]
) {
  const searchBox = document.getElementsByClassName(
    'fuzzy-search-wrapped'
  )?.[0] as HTMLInputElement;
  const searchAlertRoot = document.getElementById(
    'custom-search-alert'
  ) as HTMLDivElement;
  const searchAlertTemplate = document.getElementById(
    'alert-template'
  ) as HTMLDivElement;

  const parentList = new List(element, options, values);
  const updatableList = Object.create(parentList) as UpdatableList;

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

  const doSearch = async () => {
    searchAlertRoot.innerHTML = null;
    const searchString = searchBox.value.trim();
    if (apmCustomSearch.regex.test(searchString)) {
      let searchFunctionPromise: Promise<string>;
      parentList.search(
        searchString,
        ((escapedSearchString: string) =>
          (searchFunctionPromise = updatableList.searchFunction(
            parentList.items as List.ListItem[],
            escapedSearchString.replaceAll('\\', '')
          ))) as never
      );
      const alertString = await searchFunctionPromise;
      if (alertString) {
        const searchAlert = searchAlertTemplate.cloneNode(
          true
        ) as HTMLDivElement;
        searchAlert.removeAttribute('id');
        (
          searchAlert.getElementsByClassName(
            'alert-text'
          )?.[0] as HTMLDivElement
        ).innerText = alertString;
        searchAlertRoot.appendChild(searchAlert);
      }
    } else parentList.fuzzySearch(searchString);
  };
  searchBox.addEventListener('input', async () => await doSearch());

  updatableList.update = async (searchFunction?) => {
    parentList.update();

    updatableList.filterFunction &&
      parentList.filter(updatableList.filterFunction);

    searchFunction && (updatableList.searchFunction = searchFunction);
    searchBox.value && (await doSearch());

    updatableList.sortState &&
      parentList.sort(
        updatableList.sortState.value,
        updatableList.sortState.options
      );
  };
  updatableList.update(apmCustomSearch.searchFunction);

  return updatableList;
}

export default createList;
