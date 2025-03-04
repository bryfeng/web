import { ethereum } from '@shapeshiftoss/chain-adapters'
import type { HDWallet } from '@shapeshiftoss/hdwallet-core'
import { KnownChainIds } from '@shapeshiftoss/types'
import * as unchained from '@shapeshiftoss/unchained-client'
import type { AxiosStatic } from 'axios'
import Web3 from 'web3'
import { bnOrZero } from 'lib/bignumber/bignumber'

import type { BuildTradeInput, QuoteFeeData } from '../../../api'
import { APPROVAL_GAS_LIMIT } from '../../utils/constants'
import type { ZrxTrade } from '../types'
import { setupZrxTradeQuoteResponse } from '../utils/test-data/setupZrxSwapQuote'
import { zrxServiceFactory } from '../utils/zrxService'
import type { ZrxSupportedChainId } from '../ZrxSwapper'
import { zrxBuildTrade } from './zrxBuildTrade'

jest.mock('web3')

jest.mock('lib/swapper/swappers/ZrxSwapper/utils/zrxService', () => {
  const axios: AxiosStatic = jest.createMockFromModule('axios')
  axios.create = jest.fn(() => axios)

  return {
    zrxServiceFactory: () => axios.create(),
  }
})

// @ts-ignore
Web3.mockImplementation(() => ({
  eth: {
    Contract: jest.fn(() => ({
      methods: {
        allowance: jest.fn(() => ({
          call: jest.fn(),
        })),
      },
    })),
  },
}))

const setup = () => {
  const ethNodeUrl = 'http://localhost:1000'
  const web3Provider = new Web3.providers.HttpProvider(ethNodeUrl)
  const web3Instance = new Web3(web3Provider)
  const adapter = new ethereum.ChainAdapter({
    providers: {
      ws: new unchained.ws.Client<unchained.ethereum.Tx>('ws://localhost:31300'),
      http: new unchained.ethereum.V1Api(
        new unchained.ethereum.Configuration({
          basePath: 'http://localhost:31300',
        }),
      ),
    },
    rpcUrl: ethNodeUrl,
  })
  const zrxService = zrxServiceFactory('https://api.0x.org/')

  return { web3Instance, adapter, zrxService }
}

describe('zrxBuildTrade', () => {
  const { quoteResponse, sellAsset, buyAsset } = setupZrxTradeQuoteResponse()
  const { web3Instance, adapter, zrxService } = setup()
  const walletAddress = '0xc770eefad204b5180df6a14ee197d99d808ee52d'
  const wallet = {
    ethGetAddress: jest.fn(() => Promise.resolve(walletAddress)),
  } as unknown as HDWallet
  const deps = {
    adapter,
    web3: web3Instance,
  }

  const buildTradeInput: BuildTradeInput = {
    chainId: KnownChainIds.EthereumMainnet,
    sendMax: false,
    sellAsset,
    buyAsset,
    sellAmountBeforeFeesCryptoBaseUnit: '1000000000000000000',
    accountNumber: 0,
    wallet,
    receiveAddress: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
  }

  const buildTradeResponse: ZrxTrade<ZrxSupportedChainId> = {
    sellAsset,
    buyAsset,
    sellAmountBeforeFeesCryptoBaseUnit: quoteResponse.sellAmount,
    buyAmountCryptoBaseUnit: '',
    depositAddress: quoteResponse.to,
    receiveAddress: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
    accountNumber: 0,
    txData: quoteResponse.data,
    rate: quoteResponse.price,
    feeData: {
      chainSpecific: {
        approvalFeeCryptoBaseUnit: '123600000',
        estimatedGasCryptoBaseUnit: '1235',
        gasPriceCryptoBaseUnit: '1236',
      },
      networkFeeCryptoBaseUnit: (
        Number(quoteResponse.gas) * Number(quoteResponse.gasPrice)
      ).toString(),
      sellAssetTradeFeeUsd: '0',
      buyAssetTradeFeeUsd: '0',
    },
    sources: [],
  }

  it('should return a quote response', async () => {
    const allowanceOnChain = '1000'
    const data = {
      ...quoteResponse,
    }
    ;(web3Instance.eth.Contract as jest.Mock<unknown>).mockImplementation(() => ({
      methods: {
        allowance: jest.fn(() => ({
          call: jest.fn(() => allowanceOnChain),
        })),
      },
    }))
    ;(zrxService.get as jest.Mock<unknown>).mockReturnValue(Promise.resolve({ data }))

    const maybeBuiltTrade = await zrxBuildTrade(deps, { ...buildTradeInput })
    expect(maybeBuiltTrade.isOk()).toBe(true)
    expect(maybeBuiltTrade.unwrap()).toEqual({
      ...buildTradeResponse,
      buyAsset,
    })
  })

  it('should return a quote response with rate when price is given', async () => {
    const allowanceOnChain = '1000'
    const price = '1000'
    const data = {
      ...quoteResponse,
      price,
    }
    ;(web3Instance.eth.Contract as jest.Mock<unknown>).mockImplementation(() => ({
      methods: {
        allowance: jest.fn(() => ({
          call: jest.fn(() => allowanceOnChain),
        })),
      },
    }))
    ;(zrxService.get as jest.Mock<unknown>).mockReturnValue(Promise.resolve({ data }))

    const maybeBuiltTrade = await zrxBuildTrade(deps, { ...buildTradeInput })
    expect(maybeBuiltTrade.isOk()).toBe(true)
    expect(maybeBuiltTrade.unwrap()).toEqual({
      ...buildTradeResponse,
      rate: price,
      buyAsset,
    })
  })

  it('should return a quote response with gasPrice multiplied by estimatedGas', async () => {
    const gasPriceCryptoBaseUnit = '10000'
    const estimatedGas = '100'
    const data = {
      ...quoteResponse,
      allowanceTarget: 'allowanceTargetAddress',
      gas: estimatedGas,
      gasPrice: gasPriceCryptoBaseUnit,
    }
    ;(zrxService.get as jest.Mock<unknown>).mockReturnValue(Promise.resolve({ data }))

    const expectedFeeData: QuoteFeeData<ZrxSupportedChainId> = {
      chainSpecific: {
        approvalFeeCryptoBaseUnit: bnOrZero(APPROVAL_GAS_LIMIT)
          .multipliedBy(gasPriceCryptoBaseUnit)
          .toString(),
        gasPriceCryptoBaseUnit,
        estimatedGasCryptoBaseUnit: estimatedGas,
      },
      buyAssetTradeFeeUsd: '0',
      sellAssetTradeFeeUsd: '0',
      networkFeeCryptoBaseUnit: bnOrZero(gasPriceCryptoBaseUnit)
        .multipliedBy(estimatedGas)
        .toString(),
    }

    const maybeBuiltTrade = await zrxBuildTrade(deps, { ...buildTradeInput, wallet })
    expect(maybeBuiltTrade.isOk()).toBe(true)
    expect(maybeBuiltTrade.unwrap()).toEqual({
      ...buildTradeResponse,
      feeData: expectedFeeData,
      buyAsset,
    })
  })
})
