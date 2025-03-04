import { fromAssetId } from '@shapeshiftoss/caip'
import type { EvmChainId } from '@shapeshiftoss/chain-adapters'
import { getChainAdapterManager } from 'context/PluginProvider/chainAdapterSingleton'
import { bnOrZero } from 'lib/bignumber/bignumber'
import type { ApprovalNeededInput, ApprovalNeededOutput } from 'lib/swapper/api'
import { SwapError, SwapErrorType } from 'lib/swapper/api'
import { erc20AllowanceAbi } from 'lib/swapper/swappers/utils/abi/erc20Allowance-abi'
import { getERC20Allowance } from 'lib/swapper/swappers/utils/helpers/helpers'
import { getWeb3InstanceByChainId } from 'lib/web3-instance'

export const approvalNeeded = async ({
  quote,
  wallet,
}: ApprovalNeededInput<EvmChainId>): Promise<ApprovalNeededOutput> => {
  const { accountNumber, allowanceContract, sellAmountBeforeFeesCryptoBaseUnit, sellAsset } = quote

  const adapterManager = getChainAdapterManager()
  const adapter = adapterManager.get(sellAsset.chainId)
  const web3 = getWeb3InstanceByChainId(sellAsset.chainId)

  if (adapter === undefined) {
    throw new SwapError('[approvalNeeded] - getChainAdapterManager returned undefined', {
      code: SwapErrorType.UNSUPPORTED_NAMESPACE,
      details: { chainId: sellAsset.chainId },
    })
  }

  const { assetReference: sellAssetErc20Address } = fromAssetId(sellAsset.assetId)

  // native assets do not require approval
  if (sellAsset.assetId === adapter.getFeeAssetId()) return { approvalNeeded: false }

  try {
    const receiveAddress = await adapter.getAddress({ accountNumber, wallet })

    if (!allowanceContract) {
      throw new SwapError('[approvalNeeded] - allowanceTarget is required', {
        code: SwapErrorType.VALIDATION_FAILED,
        details: { chainId: sellAsset.chainId },
      })
    }

    const allowanceResult = await getERC20Allowance({
      web3,
      erc20AllowanceAbi,
      sellAssetErc20Address,
      spenderAddress: allowanceContract,
      ownerAddress: receiveAddress,
    })

    const allowanceOnChain = bnOrZero(allowanceResult)

    return {
      approvalNeeded: allowanceOnChain.lt(bnOrZero(sellAmountBeforeFeesCryptoBaseUnit)),
    }
  } catch (e) {
    if (e instanceof SwapError) throw e
    throw new SwapError('[approvalNeeded]', {
      cause: e,
      code: SwapErrorType.CHECK_APPROVAL_FAILED,
    })
  }
}
