import { createReducer } from 'reduxsauce';

import { SetSortingType, SetSortingOrder, SetCurrentPage, SetFilter } from '$redux/actions/tables';
import TYPES from '$redux/types/tables';
import { Handler } from '$typings/redux';

export interface State {
  sortBy: { [table: string]: string },
  ascending: { [table: string]: boolean },
  page: { [table: string]: number },
  filter: { [table: string]: string }
};

export const INITIAL_STATE: State = {
  sortBy: {},
  ascending: {},
  page: {},
  filter: {}
};

const setSortingType: Handler<State, SetSortingType> = (state, { payload }) => {
  const { table, sortBy } = payload;
  return {
    ...state,
    sortBy: { ...state.sortBy, [table]: sortBy }
  };
}

const setSortingOrder: Handler<State, SetSortingOrder> = (state, { payload }) => {
  const { table, ascending } = payload;
  return {
    ...state,
    ascending: { ...state.ascending, [table]: ascending }
  };
}

const setCurrentPage: Handler<State, SetCurrentPage> = (state, { payload }) => {
  const { table, page } = payload;
  return {
    ...state,
    page: { ...state.page, [table]: page }
  };
}

const setFilter: Handler<State, SetFilter> = (state, { payload }) => {
  const { table, filter } = payload;
  return {
    ...state,
    filter: { ...state.filter, [table]: filter }
  };
}

const HANDLERS = {
  [TYPES.SET_SORTING_TYPE]: setSortingType,
  [TYPES.SET_SORTING_ORDER]: setSortingOrder,
  [TYPES.SET_CURRENT_PAGE]: setCurrentPage,
  [TYPES.SET_FILTER]: setFilter
};

export default createReducer(INITIAL_STATE, HANDLERS);
