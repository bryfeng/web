import type { ReduxState } from 'state/reducer'

import { initialState } from '../slices/opportunitiesSlice/opportunitiesSlice'

export const cosmosSdkOpportunitiesSliceAbstraction = (state: ReduxState): ReduxState => {
  // Migration to clear opportunitiesApi and opportunitiesApi state
  return {
    ...state,
    opportunities: initialState,
  }
}
