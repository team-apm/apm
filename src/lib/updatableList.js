const List = require('list.js');

/**
 * Keep the state of the table even after update() is executed
 *
 * @param {string | HTMLElement} element id of the list area
 * @param {List.ListOptions} options option parameters
 * @param {object[]} values values to add to the list
 * @returns {List} List.js List
 */
function createList(element, options, values) {
  const parentList = new List(element, options, values);
  const updatableList = Object.create(parentList);

  parentList.on('sortComplete', () => {
    const sortAsc = [...(document.getElementsByClassName('sort asc') ?? [])];
    const sortDesc = [...(document.getElementsByClassName('sort desc') ?? [])];
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
  });

  updatableList.filter = (filterFunction) => {
    updatableList.filterFunction = filterFunction;
    parentList.filter(filterFunction);
  };

  updatableList.update = () => {
    parentList.update();

    updatableList.filterFunction &&
      parentList.filter(updatableList.filterFunction);

    const searchString =
      document.getElementsByClassName('fuzzy-search')?.[0].value;
    searchString && parentList.fuzzySearch(searchString);

    updatableList.sortState &&
      parentList.sort(
        updatableList.sortState.value,
        updatableList.sortState.options
      );
  };
  return updatableList;
}

module.exports = createList;
