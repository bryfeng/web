import type { ethereum } from '@shapeshiftoss/chain-adapters'
import type Web3 from 'web3'

import type { TradeResult } from '../../../api'
import type { CowSwapperDeps } from '../CowSwapper'
import { cowService } from '../utils/cowService'
import { cowGetTradeTxs } from './cowGetTradeTxs'

jest.mock('../utils/cowService')

describe('cowGetTradeTxs', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should call cowService with correct parameters and return an empty string if the order is not fulfilled', async () => {
    const deps: CowSwapperDeps = {
      apiUrl: 'https://api.cow.fi/mainnet/api',
      adapter: {} as unknown as ethereum.ChainAdapter,
      web3: {} as Web3,
    }

    const input: TradeResult = {
      tradeId: 'tradeId1112345',
    }

    ;(cowService.get as jest.Mock<unknown>).mockReturnValue(
      Promise.resolve({
        data: {
          status: 'open',
        },
      }),
    )

    const maybeResult = await cowGetTradeTxs(deps, input)

    expect(maybeResult.isErr()).toBe(false)
    const result = maybeResult.unwrap()
    expect(result).toEqual({ sellTxid: '' })
    expect(cowService.get).toHaveBeenCalledWith(
      'https://api.cow.fi/mainnet/api/v1/orders/tradeId1112345',
    )
    expect(cowService.get).toHaveBeenCalledTimes(1)
  })

  it('should call cowService with correct parameters and return the tx hash if the order is fulfilled', async () => {
    const deps: CowSwapperDeps = {
      apiUrl: 'https://api.cow.fi/mainnet/api',
      adapter: {} as unknown as ethereum.ChainAdapter,
      web3: {} as Web3,
    }

    const input: TradeResult = {
      tradeId: 'tradeId1112345',
    }

    ;(cowService.get as jest.Mock<unknown>)
      .mockReturnValueOnce(
        Promise.resolve({
          data: {
            status: 'fulfilled',
          },
        }),
      )
      .mockReturnValueOnce(
        Promise.resolve({
          data: [{ txHash: '123txHash456' }],
        }),
      )

    const maybeResult = await cowGetTradeTxs(deps, input)

    expect(maybeResult.isErr()).toBe(false)
    const result = maybeResult.unwrap()
    expect(result).toEqual({ sellTxid: 'tradeId1112345', buyTxid: '123txHash456' })
    expect(cowService.get).toHaveBeenNthCalledWith(
      1,
      'https://api.cow.fi/mainnet/api/v1/orders/tradeId1112345',
    )
    expect(cowService.get).toHaveBeenNthCalledWith(
      2,
      'https://api.cow.fi/mainnet/api/v1/trades/?orderUid=tradeId1112345',
    )
    expect(cowService.get).toHaveBeenCalledTimes(2)
  })
})
