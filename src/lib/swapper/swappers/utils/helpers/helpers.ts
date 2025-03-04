import type { Asset } from '@shapeshiftoss/asset-service'
import type { AssetId } from '@shapeshiftoss/caip'
import {
  avalancheAssetId,
  bscAssetId,
  ethAssetId,
  fromAssetId,
  optimismAssetId,
  polygonAssetId,
} from '@shapeshiftoss/caip'
import type { EvmChainAdapter, EvmChainId } from '@shapeshiftoss/chain-adapters'
import type { HDWallet } from '@shapeshiftoss/hdwallet-core'
import { KnownChainIds } from '@shapeshiftoss/types'
import type Web3 from 'web3'
import type { AbiItem } from 'web3-utils'
import { numberToHex } from 'web3-utils'
import type { BigNumber } from 'lib/bignumber/bignumber'
import { bn, bnOrZero } from 'lib/bignumber/bignumber'
import type { TradeQuote } from 'lib/swapper/api'
import { SwapError, SwapErrorType } from 'lib/swapper/api'
import { MAX_ALLOWANCE } from 'lib/swapper/swappers/CowSwapper/utils/constants'
import { erc20Abi as erc20AbiImported } from 'lib/swapper/swappers/utils/abi/erc20-abi'

export type IsApprovalRequiredArgs = {
  adapter: EvmChainAdapter
  receiveAddress: string
  allowanceContract: string
  sellAsset: Asset
  sellAmountExcludeFeeCryptoBaseUnit: string
  web3: Web3
  erc20AllowanceAbi: AbiItem[]
}

export type GetERC20AllowanceArgs = {
  erc20AllowanceAbi: AbiItem[]
  web3: Web3
  sellAssetErc20Address: string
  ownerAddress: string
  spenderAddress: string
}

export type GetApproveContractDataArgs = {
  web3: Web3
  spenderAddress: string
  contractAddress: string
}

type GrantAllowanceArgs<T extends EvmChainId> = {
  quote: TradeQuote<T>
  wallet: HDWallet
  adapter: EvmChainAdapter
  erc20Abi: AbiItem[]
  web3: Web3
}

export const getERC20Allowance = ({
  erc20AllowanceAbi,
  web3,
  sellAssetErc20Address,
  ownerAddress,
  spenderAddress,
}: GetERC20AllowanceArgs): Promise<any> => {
  const erc20Contract = new web3.eth.Contract(erc20AllowanceAbi, sellAssetErc20Address)
  return erc20Contract.methods.allowance(ownerAddress, spenderAddress).call()
}

export const isApprovalRequired = async ({
  adapter,
  receiveAddress,
  allowanceContract,
  sellAsset,
  sellAmountExcludeFeeCryptoBaseUnit,
  web3,
  erc20AllowanceAbi,
}: IsApprovalRequiredArgs): Promise<boolean> => {
  try {
    if (sellAsset.assetId === adapter.getFeeAssetId()) {
      return false
    }

    const ownerAddress = receiveAddress
    const spenderAddress = allowanceContract

    const { assetReference: sellAssetErc20Address } = fromAssetId(sellAsset.assetId)

    const allowanceOnChain = await getERC20Allowance({
      web3,
      erc20AllowanceAbi,
      ownerAddress,
      spenderAddress,
      sellAssetErc20Address,
    })
    if (!allowanceOnChain) {
      throw new SwapError(`[isApprovalRequired] - No allowance data`, {
        details: { allowanceContract, receiveAddress },
        code: SwapErrorType.RESPONSE_ERROR,
      })
    }

    if (bn(allowanceOnChain).isZero()) return true

    const allowanceRequired = bnOrZero(sellAmountExcludeFeeCryptoBaseUnit).minus(allowanceOnChain)
    return allowanceRequired.gt(0)
  } catch (e) {
    if (e instanceof SwapError) throw e
    throw new SwapError('[isApprovalRequired]', {
      cause: e,
      code: SwapErrorType.ALLOWANCE_REQUIRED_FAILED,
    })
  }
}

export const grantAllowance = async <T extends EvmChainId>({
  quote,
  wallet,
  adapter,
  erc20Abi,
  web3,
}: GrantAllowanceArgs<T>): Promise<string> => {
  try {
    const { assetReference: sellAssetErc20Address } = fromAssetId(quote.sellAsset.assetId)

    const erc20Contract = new web3.eth.Contract(erc20Abi, sellAssetErc20Address)
    const approveTx = erc20Contract.methods
      .approve(quote.allowanceContract, quote.sellAmountBeforeFeesCryptoBaseUnit)
      .encodeABI()

    const { accountNumber } = quote

    const { txToSign } = await adapter.buildSendTransaction({
      wallet,
      to: sellAssetErc20Address,
      accountNumber,
      value: '0',
      chainSpecific: {
        tokenContractAddress: sellAssetErc20Address,
        gasPrice: numberToHex(quote.feeData?.chainSpecific?.gasPriceCryptoBaseUnit || 0),
        gasLimit: numberToHex(quote.feeData?.chainSpecific?.estimatedGasCryptoBaseUnit || 0),
      },
    })

    const grantAllowanceTxToSign = {
      ...txToSign,
      data: approveTx,
    }
    if (wallet.supportsOfflineSigning()) {
      const signedTx = await adapter.signTransaction({ txToSign: grantAllowanceTxToSign, wallet })

      const broadcastedTxId = await adapter.broadcastTransaction(signedTx)

      return broadcastedTxId
    } else if (wallet.supportsBroadcast() && adapter.signAndBroadcastTransaction) {
      const broadcastedTxId = await adapter.signAndBroadcastTransaction?.({
        txToSign: grantAllowanceTxToSign,
        wallet,
      })

      return broadcastedTxId
    } else {
      throw new SwapError('[grantAllowance] - invalid HDWallet config', {
        code: SwapErrorType.SIGN_AND_BROADCAST_FAILED,
      })
    }
  } catch (e) {
    if (e instanceof SwapError) throw e
    throw new SwapError('[grantAllowance]', {
      cause: e,
      code: SwapErrorType.GRANT_ALLOWANCE_FAILED,
    })
  }
}

/**
 * This function keeps 17 significant digits, so even if we try to trade 1 Billion of an
 * ETH or ERC20, we still keep 7 decimal places.
 * @param amount
 */
export const normalizeAmount = (amount: string | number | BigNumber): string => {
  return bnOrZero(amount).toNumber().toLocaleString('fullwide', { useGrouping: false })
}

export const normalizeIntegerAmount = (amount: string | number | BigNumber): string => {
  return bnOrZero(amount)
    .integerValue()
    .toNumber()
    .toLocaleString('fullwide', { useGrouping: false })
}

export const getApproveContractData = ({
  web3,
  spenderAddress,
  contractAddress,
}: GetApproveContractDataArgs): string => {
  const contract = new web3.eth.Contract(erc20AbiImported, contractAddress)
  return contract.methods.approve(spenderAddress, MAX_ALLOWANCE).encodeABI()
}

export const isNativeEvmAsset = (assetId: AssetId): boolean => {
  const { chainId } = fromAssetId(assetId)
  switch (chainId) {
    case KnownChainIds.EthereumMainnet:
      return assetId === ethAssetId
    case KnownChainIds.AvalancheMainnet:
      return assetId === avalancheAssetId
    case KnownChainIds.OptimismMainnet:
      return assetId === optimismAssetId
    case KnownChainIds.BnbSmartChainMainnet:
      return assetId === bscAssetId
    case KnownChainIds.PolygonMainnet:
      return assetId === polygonAssetId
    default:
      return false
  }
}
