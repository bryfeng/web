import type { Asset } from '@shapeshiftoss/asset-service'
import type { ethereum, FeeDataEstimate } from '@shapeshiftoss/chain-adapters'
import type { HDWallet } from '@shapeshiftoss/hdwallet-core'
import { KnownChainIds } from '@shapeshiftoss/types'
import type Web3 from 'web3'

import type { BuildTradeInput } from '../../../api'
import { SwapperName } from '../../../api'
import type { IsApprovalRequiredArgs } from '../../utils/helpers/helpers'
import { ETH, FOX, WBTC, WETH } from '../../utils/test-data/assets'
import type { CowSwapperDeps } from '../CowSwapper'
import type { CowTrade } from '../types'
import { DEFAULT_APP_DATA } from '../utils/constants'
import { cowService } from '../utils/cowService'
import type { CowSwapSellQuoteApiInput } from '../utils/helpers/helpers'
import { cowBuildTrade } from './cowBuildTrade'

jest.mock('@shapeshiftoss/chain-adapters')
jest.mock('../utils/cowService')
jest.mock('../utils/helpers/helpers', () => {
  const { WETH, ETH, FOX } = require('../../utils/test-data/assets') // Move the import inside the factory function

  return {
    ...jest.requireActual('../utils/helpers/helpers'),
    getNowPlusThirtyMinutesTimestamp: () => 1656797787,
    getUsdRate: (_args: CowSwapperDeps, input: Asset) => {
      if (input.assetId === WETH.assetId || input.assetId === ETH.assetId) {
        return Promise.resolve('1233.65940923824103061992')
      }

      if (input.assetId === FOX.assetId) {
        return Promise.resolve('0.0873')
      }

      return Promise.resolve('20978.38')
    },
  }
})

jest.mock('../../utils/helpers/helpers', () => {
  const { WBTC } = require('../../utils/test-data/assets') // Move the import inside the factory function

  return {
    ...jest.requireActual('../../utils/helpers/helpers'),
    isApprovalRequired: (args: IsApprovalRequiredArgs) => args.sellAsset.assetId === WBTC.assetId,
    getApproveContractData: () => '0xABCDEFGHIJ',
  }
})

const feeData: FeeDataEstimate<KnownChainIds.EthereumMainnet> = {
  fast: {
    txFee: '4080654495000000',
    chainSpecific: {
      gasLimit: '100000',
      gasPrice: '79036500000',
      maxFeePerGas: '216214758112',
      maxPriorityFeePerGas: '2982734547',
    },
  },
  slow: {
    txFee: '4080654495000000',
    chainSpecific: {
      gasLimit: '100000',
      gasPrice: '79036500000',
      maxFeePerGas: '216214758112',
      maxPriorityFeePerGas: '2982734547',
    },
  },
  average: {
    txFee: '4080654495000000',
    chainSpecific: {
      gasLimit: '100000',
      gasPrice: '79036500000',
      maxFeePerGas: '216214758112',
      maxPriorityFeePerGas: '2982734547',
    },
  },
}

const expectedApiInputWethToFox: CowSwapSellQuoteApiInput = {
  appData: DEFAULT_APP_DATA,
  buyToken: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
  from: 'address11',
  kind: 'sell',
  partiallyFillable: false,
  receiver: 'address11',
  sellAmountBeforeFee: '1000000000000000000',
  sellToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  validTo: 1656797787,
}

const expectedApiInputWbtcToWeth: CowSwapSellQuoteApiInput = {
  appData: DEFAULT_APP_DATA,
  buyToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  from: 'address11',
  kind: 'sell',
  partiallyFillable: false,
  receiver: 'address11',
  sellAmountBeforeFee: '100000000',
  sellToken: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  validTo: 1656797787,
}

const expectedApiInputFoxToEth: CowSwapSellQuoteApiInput = {
  appData: DEFAULT_APP_DATA,
  buyToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  from: 'address11',
  kind: 'sell',
  partiallyFillable: false,
  receiver: 'address11',
  sellAmountBeforeFee: '1000000000000000000000',
  sellToken: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
  validTo: 1656797787,
}

const expectedTradeWethToFox: CowTrade<KnownChainIds.EthereumMainnet> = {
  rate: '14716.04718939437505555958', // 14716 FOX per WETH
  feeData: {
    chainSpecific: {
      estimatedGasCryptoBaseUnit: '100000',
      gasPriceCryptoBaseUnit: '79036500000',
    },
    buyAssetTradeFeeUsd: '0',
    networkFeeCryptoBaseUnit: '0',
    sellAssetTradeFeeUsd: '17.95954294012756741283729339486489192096',
  },
  sellAmountBeforeFeesCryptoBaseUnit: '1000000000000000000',
  buyAmountCryptoBaseUnit: '14501811818247595090576', // 14501 FOX
  sources: [{ name: SwapperName.CowSwap, proportion: '1' }],
  buyAsset: FOX,
  sellAsset: WETH,
  accountNumber: 0,
  receiveAddress: 'address11',
  feeAmountInSellTokenCryptoBaseUnit: '14557942658757988',
  sellAmountDeductFeeCryptoBaseUnit: '985442057341242012',
}

const expectedTradeQuoteWbtcToWethWithApprovalFeeCryptoBaseUnit: CowTrade<KnownChainIds.EthereumMainnet> =
  {
    rate: '19.13939810252384532346', // 19.14 WETH per WBTC
    feeData: {
      chainSpecific: {
        estimatedGasCryptoBaseUnit: '100000',
        gasPriceCryptoBaseUnit: '79036500000',
        approvalFeeCryptoBaseUnit: '7903650000000000',
      },
      buyAssetTradeFeeUsd: '0',
      networkFeeCryptoBaseUnit: '0',
      sellAssetTradeFeeUsd: '3.6162531444',
    },
    sellAmountBeforeFeesCryptoBaseUnit: '100000000',
    buyAmountCryptoBaseUnit: '19136098853078932263', // 19.13 WETH
    sources: [{ name: SwapperName.CowSwap, proportion: '1' }],
    buyAsset: WETH,
    sellAsset: WBTC,
    accountNumber: 0,
    receiveAddress: 'address11',
    feeAmountInSellTokenCryptoBaseUnit: '17238',
    sellAmountDeductFeeCryptoBaseUnit: '99982762',
  }

const expectedTradeQuoteFoxToEth: CowTrade<KnownChainIds.EthereumMainnet> = {
  rate: '0.00004995640398295996',
  feeData: {
    chainSpecific: {
      estimatedGasCryptoBaseUnit: '100000',
      gasPriceCryptoBaseUnit: '79036500000',
    },
    buyAssetTradeFeeUsd: '0',
    networkFeeCryptoBaseUnit: '0',
    sellAssetTradeFeeUsd: '5.3955565850972847808512',
  },
  sellAmountBeforeFeesCryptoBaseUnit: '1000000000000000000000',
  buyAmountCryptoBaseUnit: '46868859830863283',
  sources: [{ name: SwapperName.CowSwap, proportion: '1' }],
  buyAsset: ETH,
  sellAsset: FOX,
  accountNumber: 0,
  receiveAddress: 'address11',
  feeAmountInSellTokenCryptoBaseUnit: '61804771879693983744',
  sellAmountDeductFeeCryptoBaseUnit: '938195228120306016256',
}

const deps: CowSwapperDeps = {
  apiUrl: 'https://api.cow.fi/mainnet/api',
  adapter: {
    getAddress: jest.fn(() => Promise.resolve('address11')),
    getFeeData: jest.fn(() => Promise.resolve(feeData)),
  } as unknown as ethereum.ChainAdapter,
  web3: {} as Web3,
}

describe('cowBuildTrade', () => {
  it('should throw an exception if both assets are not erc20s', async () => {
    const tradeInput: BuildTradeInput = {
      chainId: KnownChainIds.EthereumMainnet,
      sellAsset: ETH,
      buyAsset: FOX,
      sellAmountBeforeFeesCryptoBaseUnit: '11111',
      sendMax: true,
      accountNumber: 0,
      wallet: {} as HDWallet,
      receiveAddress: '',
    }

    const maybeCowBuildTrade = await cowBuildTrade(deps, tradeInput)
    expect(maybeCowBuildTrade.isErr()).toBe(true)
    expect(maybeCowBuildTrade.unwrapErr()).toMatchObject({
      cause: undefined,
      code: 'UNSUPPORTED_PAIR',
      details: { sellAssetNamespace: 'slip44' },
      message: '[cowBuildTrade] - Sell asset needs to be ERC-20 to use CowSwap',
      name: 'SwapError',
    })
  })

  it('should call cowService with correct parameters, handle the fees and return the correct trade when selling WETH', async () => {
    const tradeInput: BuildTradeInput = {
      chainId: KnownChainIds.EthereumMainnet,
      sellAsset: WETH,
      buyAsset: FOX,
      sellAmountBeforeFeesCryptoBaseUnit: '1000000000000000000',
      sendMax: true,
      accountNumber: 0,
      wallet: {} as HDWallet,
      receiveAddress: '',
    }

    ;(cowService.post as jest.Mock<unknown>).mockReturnValue(
      Promise.resolve({
        data: {
          quote: {
            ...expectedApiInputWethToFox,
            sellAmountBeforeFee: undefined,
            sellAmount: '985442057341242012',
            buyAmount: '14501811818247595090576',
            feeAmount: '14557942658757988',
            sellTokenBalance: 'erc20',
            buyTokenBalance: 'erc20',
          },
        },
      }),
    )

    const maybeBuiltTrade = await cowBuildTrade(deps, tradeInput)

    expect(maybeBuiltTrade.isOk()).toBe(true)
    expect(maybeBuiltTrade.unwrap()).toEqual(expectedTradeWethToFox)
    expect(cowService.post).toHaveBeenCalledWith(
      'https://api.cow.fi/mainnet/api/v1/quote/',
      expectedApiInputWethToFox,
    )
  })

  it('should call cowService with correct parameters, handle the fees and return the correct trade when selling WBTC with allowance being required', async () => {
    const tradeInput: BuildTradeInput = {
      chainId: KnownChainIds.EthereumMainnet,
      sellAsset: WBTC,
      buyAsset: WETH,
      sellAmountBeforeFeesCryptoBaseUnit: '100000000',
      sendMax: true,
      accountNumber: 0,
      wallet: {} as HDWallet,
      receiveAddress: '',
    }

    ;(cowService.post as jest.Mock<unknown>).mockReturnValue(
      Promise.resolve({
        data: {
          quote: {
            ...expectedApiInputWbtcToWeth,
            sellAmountBeforeFee: undefined,
            sellAmount: '99982762',
            buyAmount: '19136098853078932263',
            feeAmount: '17238',
            sellTokenBalance: 'erc20',
            buyTokenBalance: 'erc20',
          },
        },
      }),
    )

    const maybeBuiltTrade = await cowBuildTrade(deps, tradeInput)
    expect(maybeBuiltTrade.isOk()).toBe(true)

    expect(maybeBuiltTrade.unwrap()).toEqual(
      expectedTradeQuoteWbtcToWethWithApprovalFeeCryptoBaseUnit,
    )
    expect(cowService.post).toHaveBeenCalledWith(
      'https://api.cow.fi/mainnet/api/v1/quote/',
      expectedApiInputWbtcToWeth,
    )
  })

  it('should call cowService with correct parameters, handle the fees and return the correct trade when buying ETH', async () => {
    const tradeInput: BuildTradeInput = {
      chainId: KnownChainIds.EthereumMainnet,
      sellAsset: FOX,
      buyAsset: ETH,
      sellAmountBeforeFeesCryptoBaseUnit: '1000000000000000000000',
      sendMax: true,
      accountNumber: 0,
      wallet: {} as HDWallet,
      receiveAddress: '',
    }

    ;(cowService.post as jest.Mock<unknown>).mockReturnValue(
      Promise.resolve({
        data: {
          quote: {
            ...expectedApiInputFoxToEth,
            sellAmountBeforeFee: undefined,
            sellAmount: '938195228120306016256',
            buyAmount: '46868859830863283',
            feeAmount: '61804771879693983744',
            sellTokenBalance: 'erc20',
            buyTokenBalance: 'erc20',
          },
        },
      }),
    )

    const maybeBuiltTrade = await cowBuildTrade(deps, tradeInput)
    expect(maybeBuiltTrade.isOk()).toBe(true)

    expect(maybeBuiltTrade.unwrap()).toEqual(expectedTradeQuoteFoxToEth)
    expect(cowService.post).toHaveBeenCalledWith(
      'https://api.cow.fi/mainnet/api/v1/quote/',
      expectedApiInputFoxToEth,
    )
  })
})
