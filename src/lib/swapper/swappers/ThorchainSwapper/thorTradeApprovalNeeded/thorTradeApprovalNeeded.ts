import { CHAIN_NAMESPACE, fromAssetId, fromChainId } from '@shapeshiftoss/caip'
import type { KnownChainIds } from '@shapeshiftoss/types'
import { bnOrZero } from 'lib/bignumber/bignumber'
import type { ApprovalNeededInput, ApprovalNeededOutput } from 'lib/swapper/api'
import { SwapError, SwapErrorType } from 'lib/swapper/api'
import type { ThorchainSwapperDeps } from 'lib/swapper/swappers/ThorchainSwapper/types'
import { erc20AllowanceAbi } from 'lib/swapper/swappers/utils/abi/erc20Allowance-abi'
import { getERC20Allowance } from 'lib/swapper/swappers/utils/helpers/helpers'

export const thorTradeApprovalNeeded = async ({
  deps,
  input,
}: {
  deps: ThorchainSwapperDeps
  input: ApprovalNeededInput<KnownChainIds.EthereumMainnet>
}): Promise<ApprovalNeededOutput> => {
  try {
    const { quote, wallet } = input
    const { sellAsset, accountNumber } = quote
    const { adapterManager, web3 } = deps

    const { assetReference: sellAssetErc20Address } = fromAssetId(sellAsset.assetId)
    const { chainNamespace } = fromChainId(sellAsset.chainId)

    if (chainNamespace !== CHAIN_NAMESPACE.Evm) return { approvalNeeded: false }

    const adapter = adapterManager.get(sellAsset.chainId)

    if (!adapter)
      throw new SwapError(
        `[thorTradeApprovalNeeded] - no chain adapter found for chain Id: ${sellAsset.chainId}`,
        {
          code: SwapErrorType.UNSUPPORTED_CHAIN,
          details: { chainId: sellAsset.chainId },
        },
      )

    // No approval needed for selling a fee asset
    if (sellAsset.assetId === adapter.getFeeAssetId()) {
      return { approvalNeeded: false }
    }

    const receiveAddress = await adapter.getAddress({ wallet, accountNumber })

    if (!quote.allowanceContract) {
      throw new SwapError('[thorTradeApprovalNeeded] - allowanceTarget is required', {
        code: SwapErrorType.VALIDATION_FAILED,
        details: { chainId: sellAsset.chainId },
      })
    }

    const allowanceResult = await getERC20Allowance({
      web3,
      erc20AllowanceAbi,
      sellAssetErc20Address,
      spenderAddress: quote.allowanceContract,
      ownerAddress: receiveAddress,
    })
    const allowanceOnChain = bnOrZero(allowanceResult)

    if (!quote.feeData.chainSpecific?.gasPriceCryptoBaseUnit)
      throw new SwapError('[thorTradeApprovalNeeded] - no gas price with quote', {
        code: SwapErrorType.RESPONSE_ERROR,
        details: { feeData: quote.feeData },
      })
    return {
      approvalNeeded: allowanceOnChain.lt(bnOrZero(quote.sellAmountBeforeFeesCryptoBaseUnit)),
    }
  } catch (e) {
    if (e instanceof SwapError) throw e
    throw new SwapError('[thorTradeApprovalNeeded]', {
      cause: e,
      code: SwapErrorType.CHECK_APPROVAL_FAILED,
    })
  }
}
