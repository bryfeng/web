import type { StartQueryActionCreatorOptions } from '@reduxjs/toolkit/dist/query/core/buildInitiate'
import type { AccountId } from '@shapeshiftoss/caip'
import { DefiProvider, DefiType } from 'features/defi/contexts/DefiManagerProvider/DefiCommon'
import { store } from 'state/store'

import { foxEthStakingIds } from '../opportunitiesSlice/constants'
import { opportunitiesApi } from '../opportunitiesSlice/opportunitiesSlice'

export const fetchAllLpOpportunitiesMetadata = async (options?: StartQueryActionCreatorOptions) => {
  const { getOpportunitiesMetadata } = opportunitiesApi.endpoints

  await Promise.allSettled([
    store.dispatch(
      opportunitiesApi.endpoints.getOpportunitiesMetadata.initiate(
        {
          defiType: DefiType.LiquidityPool,
          defiProvider: DefiProvider.UniV2,
          opportunityType: DefiType.LiquidityPool,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      getOpportunitiesMetadata.initiate(
        {
          opportunityType: DefiType.LiquidityPool,
          defiType: DefiType.LiquidityPool,
          defiProvider: DefiProvider.OsmosisLp,
        },
        { forceRefetch: false, ...options },
      ),
    ),
  ])
}

export const fetchAllStakingOpportunitiesMetadata = async (
  options?: StartQueryActionCreatorOptions,
) => {
  const { getOpportunityMetadata } = opportunitiesApi.endpoints

  const metadataPromises = [
    store.dispatch(
      opportunitiesApi.endpoints.getOpportunitiesMetadata.initiate(
        {
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.CosmosSdk,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      opportunitiesApi.endpoints.getOpportunitiesMetadata.initiate(
        {
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.ThorchainSavers,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      opportunitiesApi.endpoints.getOpportunitiesMetadata.initiate(
        {
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.Idle,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      opportunitiesApi.endpoints.getOpportunitiesMetadata.initiate(
        {
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.Yearn,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      opportunitiesApi.endpoints.getOpportunitiesMetadata.initiate(
        {
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.ShapeShift,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    ...foxEthStakingIds.map(opportunityId =>
      store.dispatch(
        getOpportunityMetadata.initiate(
          {
            opportunityId,
            opportunityType: DefiType.Staking,
            defiType: DefiType.Staking,
            defiProvider: DefiProvider.EthFoxStaking,
          },
          // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
          { forceRefetch: false, ...options },
        ),
      ),
    ),
  ]

  for (const metadataPromise of metadataPromises) {
    await metadataPromise
  }
}

export const fetchAllOpportunitiesIds = async (options?: StartQueryActionCreatorOptions) => {
  const { getOpportunityIds } = opportunitiesApi.endpoints

  const queries = [
    {
      defiType: DefiType.Staking,
      defiProvider: DefiProvider.Idle,
    },
    {
      defiType: DefiType.Staking,
      defiProvider: DefiProvider.Yearn,
    },
    {
      defiType: DefiType.Staking,
      defiProvider: DefiProvider.EthFoxStaking,
    },
    {
      defiType: DefiType.LiquidityPool,
      defiProvider: DefiProvider.UniV2,
    },
    {
      defiType: DefiType.LiquidityPool,
      defiProvider: DefiProvider.OsmosisLp,
    },
    {
      defiType: DefiType.Staking,
      defiProvider: DefiProvider.ThorchainSavers,
    },
    {
      defiType: DefiType.Staking,
      defiProvider: DefiProvider.ShapeShift,
    },
    {
      defiType: DefiType.Staking,
      defiProvider: DefiProvider.CosmosSdk,
    },
  ]

  for (const query of queries) {
    await store.dispatch(getOpportunityIds.initiate(query, options))
  }

  return
}

export const fetchAllOpportunitiesMetadata = async (options?: StartQueryActionCreatorOptions) => {
  // Don't Promise.all() me - parallel execution would be better, but the market data of the LP tokens gets populated when fetching LP opportunities
  // Without it, we won't have all we need to populate the staking one - which is relying on the market data of the staked LP token for EVM chains LP token farming
  await fetchAllLpOpportunitiesMetadata(options)
  await fetchAllStakingOpportunitiesMetadata(options)
}

export const fetchAllStakingOpportunitiesUserData = async (
  accountId: AccountId,
  options?: StartQueryActionCreatorOptions,
) => {
  const { getOpportunitiesUserData, getOpportunityUserData } = opportunitiesApi.endpoints

  await Promise.allSettled([
    store.dispatch(
      getOpportunitiesUserData.initiate(
        {
          accountId,
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.CosmosSdk,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),

    store.dispatch(
      getOpportunitiesUserData.initiate(
        {
          accountId,
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.ThorchainSavers,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      getOpportunitiesUserData.initiate(
        {
          accountId,
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.Idle,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      getOpportunitiesUserData.initiate(
        {
          accountId,
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.Yearn,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    store.dispatch(
      getOpportunitiesUserData.initiate(
        {
          accountId,
          defiType: DefiType.Staking,
          defiProvider: DefiProvider.ShapeShift,
          opportunityType: DefiType.Staking,
        },
        // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
        { forceRefetch: false, ...options },
      ),
    ),
    ...foxEthStakingIds.map(opportunityId =>
      store.dispatch(
        getOpportunityUserData.initiate(
          {
            accountId,
            opportunityId,
            opportunityType: DefiType.Staking,
            defiType: DefiType.Staking,
            defiProvider: DefiProvider.EthFoxStaking,
          },
          // Any previous query without portfolio loaded will be rejected, the first successful one will be cached
          { forceRefetch: false, ...options },
        ),
      ),
    ),
  ])
}

export const fetchAllLpOpportunitiesUserdata = (
  _accountId: AccountId,
  _options?: StartQueryActionCreatorOptions,
  // User data for all our current LP opportunities is held as a portfolio balance, there's no need to fetch it
) => Promise.resolve()

export const fetchAllOpportunitiesUserData = (
  accountId: AccountId,
  options?: StartQueryActionCreatorOptions,
) =>
  Promise.allSettled([
    fetchAllLpOpportunitiesUserdata(accountId, options),
    fetchAllStakingOpportunitiesUserData(accountId, options),
  ])
