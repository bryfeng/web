// Allow explicit any since this is a test file
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test EthereumChainAdapter
 * @group unit
 */
import { ASSET_REFERENCE, CHAIN_REFERENCE, ethAssetId, ethChainId } from '@shapeshiftoss/caip'
import type { ETHSignMessage, ETHSignTx, ETHWallet } from '@shapeshiftoss/hdwallet-core'
import type { NativeAdapterArgs } from '@shapeshiftoss/hdwallet-native'
import { NativeHDWallet } from '@shapeshiftoss/hdwallet-native'
import type { BIP44Params } from '@shapeshiftoss/types'
import { KnownChainIds } from '@shapeshiftoss/types'
import type * as unchained from '@shapeshiftoss/unchained-client'
import { merge } from 'lodash'
import { numberToHex } from 'web3-utils'

import type { BuildSendTxInput, SignMessageInput, SignTxInput } from '../../types'
import { ValidAddressResultType } from '../../types'
import { toAddressNList } from '../../utils'
import { bn } from '../../utils/bignumber'
import type { ChainAdapterArgs, EvmChainId } from '../EvmBaseAdapter'
import * as ethereum from './EthereumChainAdapter'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const EOA_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const ENS_NAME = 'vitalik.eth'

const testMnemonic = 'alcohol woman abuse must during monitor noble actual mixed trade anger aisle'

const getWallet = async (): Promise<ETHWallet> => {
  const nativeAdapterArgs: NativeAdapterArgs = {
    mnemonic: testMnemonic,
    deviceId: 'test',
  }
  const wallet = new NativeHDWallet(nativeAdapterArgs)
  await wallet.initialize()

  return wallet
}

jest.mock('axios', () => ({
  get: jest.fn(() =>
    Promise.resolve({
      data: {
        result: [
          {
            source: 'MEDIAN',
            timestamp: 1639978534,
            instant: 55477500000,
            fast: 50180000000,
            standard: 45000000000,
            low: 41000000000,
          },
        ],
      },
    }),
  ),
}))

describe('EthereumChainAdapter', () => {
  const gasPrice = '42'
  const gasLimit = '42000'
  const tokenContractAddress = '0xc770eefad204b5180df6a14ee197d99d808ee52d'
  const value = 400

  const makeChainSpecific = (chainSpecificAdditionalProps?: { tokenContractAddress: string }) =>
    merge(
      {
        gasPrice,
        gasLimit,
      },
      chainSpecificAdditionalProps,
    )

  const makeGetGasFeesMockedResponse = (overrideArgs?: {
    gasPrice?: string
    slow: { gasPrice?: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }
    average: { gasPrice?: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }
    fast: { gasPrice?: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }
  }) =>
    merge(
      {
        gasPrice: '1',
        slow: { gasPrice: '1', maxFeePerGas: '274', maxPriorityFeePerGas: '10' },
        average: { gasPrice: '1', maxFeePerGas: '300', maxPriorityFeePerGas: '10' },
        fast: { gasPrice: '1', maxFeePerGas: '335', maxPriorityFeePerGas: '12' },
      },
      overrideArgs,
    )

  const makeEstimateGasMockedResponse = (overrideArgs?: { gasLimit?: string }) =>
    merge({ gasLimit: '21000' }, overrideArgs)

  const makeGetAccountMockResponse = (balance: {
    balance: string
    tokenBalance: string | undefined
  }) => ({
    balance: balance.balance,
    unconfirmedBalance: '0',
    nonce: 2,
    tokens: [
      {
        assetId: 'eip155:1/erc20:0xc770eefad204b5180df6a14ee197d99d808ee52d',
        balance: balance.tokenBalance,
        type: 'ERC20',
        contract: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
      },
    ],
  })

  const makeChainAdapterArgs = (overrideArgs?: {
    providers?: { http: unchained.ethereum.V1Api }
    chainId?: EvmChainId
  }): ChainAdapterArgs<unchained.ethereum.V1Api> =>
    merge(
      {
        providers: {
          http: {} as unknown as unchained.ethereum.V1Api,
          ws: {} as unchained.ws.Client<unchained.ethereum.Tx>,
        },
        rpcUrl: '',
      },
      overrideArgs,
    )

  describe('constructor', () => {
    it('should return chainAdapter with Ethereum mainnet chainId if called with no chainId', () => {
      const args = makeChainAdapterArgs()
      const adapter = new ethereum.ChainAdapter(args)
      const chainId = adapter.getChainId()
      expect(chainId).toEqual(ethChainId)
    })

    it('should return chainAdapter with valid chainId if called with valid chainId', () => {
      const args = makeChainAdapterArgs({ chainId: KnownChainIds.EthereumMainnet })
      const adapter = new ethereum.ChainAdapter(args)
      const chainId = adapter.getChainId()
      expect(chainId).toEqual(ethChainId)
    })
  })

  describe('getFeeAssetId', () => {
    it('should return the correct fee assetId', () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      expect(adapter.getFeeAssetId()).toEqual(ethAssetId)
    })
  })

  describe('getFeeData', () => {
    it('should return current network fees', async () => {
      const httpProvider = {
        estimateGas: jest.fn().mockResolvedValue(makeEstimateGasMockedResponse()),
        getGasFees: jest.fn().mockResolvedValue(makeGetGasFeesMockedResponse()),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const data = await adapter.getFeeData({
        to: '0x642F4Bda144C63f6DC47EE0fDfbac0a193e2eDb7',
        value: '123',
        chainSpecific: {
          from: ZERO_ADDRESS,
          contractData: '0x',
        },
      })

      expect(data).toEqual(
        expect.objectContaining({
          average: {
            chainSpecific: {
              gasLimit: '21000',
              gasPrice: '45000000000',
              maxFeePerGas: '300',
              maxPriorityFeePerGas: '10',
            },
            txFee: '945000000000000',
          },
          fast: {
            chainSpecific: {
              gasLimit: '21000',
              gasPrice: '50180000000',
              maxFeePerGas: '335',
              maxPriorityFeePerGas: '12',
            },
            txFee: '1053780000000000',
          },
          slow: {
            chainSpecific: {
              gasLimit: '21000',
              gasPrice: '41000000000',
              maxFeePerGas: '274',
              maxPriorityFeePerGas: '10',
            },
            txFee: '861000000000000',
          },
        }),
      )
    })
  })

  describe('getGasFeeData', () => {
    it('should return current network gas fees', async () => {
      const httpProvider = {
        getGasFees: jest.fn().mockResolvedValue(makeGetGasFeesMockedResponse()),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const data = await adapter.getGasFeeData()

      expect(data).toEqual(
        expect.objectContaining({
          average: {
            gasPrice: '45000000000',
            maxFeePerGas: '300',
            maxPriorityFeePerGas: '10',
          },
          fast: {
            gasPrice: '50180000000',
            maxFeePerGas: '335',
            maxPriorityFeePerGas: '12',
          },
          slow: {
            gasPrice: '41000000000',
            maxFeePerGas: '274',
            maxPriorityFeePerGas: '10',
          },
        }),
      )
    })
  })

  describe('getAddress', () => {
    const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
    const fn = jest.fn()

    it('should return a valid address', async () => {
      const wallet = await getWallet()
      const accountNumber = 0
      const res = await adapter.getAddress({ accountNumber, wallet })

      expect(res).toEqual('0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8')
    })

    it('should not show address on device by default', async () => {
      const wallet = await getWallet()
      wallet.ethGetAddress = fn.mockResolvedValue('0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8')

      const accountNumber = 0
      await adapter.getAddress({ accountNumber, wallet })

      expect(wallet.ethGetAddress).toHaveBeenCalledWith({
        addressNList: [2147483692, 2147483708, 2147483648, 0, 0],
        showDisplay: false,
      })
    })
  })

  const validAddressTuple = { valid: true, result: ValidAddressResultType.Valid }
  const invalidAddressTuple = { valid: false, result: ValidAddressResultType.Invalid }

  describe('validateAddress', () => {
    it('should return true for a valid address', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
      expect(res).toMatchObject(validAddressTuple)
    })

    it('should return false for an empty address', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateAddress('')
      expect(res).toMatchObject(invalidAddressTuple)
    })

    it('should return false for an invalid address', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateAddress('foobar')
      expect(res).toMatchObject(invalidAddressTuple)
    })
  })

  describe('validateEnsAddress', () => {
    it('should return true for a valid .eth address', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateEnsAddress(ENS_NAME)
      expect(res).toMatchObject(validAddressTuple)
    })

    it('should return false for an empty address', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateEnsAddress('')
      expect(res).toMatchObject(invalidAddressTuple)
    })

    it('should return false for an invalid address', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateEnsAddress('foobar')
      expect(res).toMatchObject(invalidAddressTuple)
    })

    it('should return false for a valid address directly followed by more chars', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateEnsAddress(`${ENS_NAME}foobar`)
      expect(res).toMatchObject(invalidAddressTuple)
    })

    it('should return false for a valid address in the middle of a string', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const res = await adapter.validateEnsAddress(`asdf${ENS_NAME}foobar`)
      expect(res).toMatchObject(invalidAddressTuple)
    })
  })

  describe('signTransaction', () => {
    it('should sign a properly formatted txToSign object', async () => {
      const balance = '2500000'
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(makeGetAccountMockResponse({ balance, tokenBalance: '424242' })),
      } as unknown as unchained.ethereum.V1Api
      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const tx = {
        wallet: await getWallet(),
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          value: '0x0',
          to: EOA_ADDRESS,
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '0x0000000000000000',
          nonce: '0x0',
          gasPrice: '0x29d41057e0',
          gasLimit: '0xc9df',
        },
      } as unknown as SignTxInput<ETHSignTx>

      await expect(adapter.signTransaction(tx)).resolves.toEqual(
        '0xf86c808529d41057e082c9df94d8da6bf26964af9d7eed9e03e53415d37aa960458088000000000000000025a04db6f6d27b6e7de2a627d7a7a213915db14d0d811e97357f1b4e3b3b25584dfaa07e4e329f23f33e1b21b3f443a80fad3255b2c968820d02b57752b4c91a9345c5',
      )
    })
    it('should throw on txToSign with invalid data', async () => {
      const balance = '2500000'
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(makeGetAccountMockResponse({ balance, tokenBalance: '424242' })),
      } as unknown as unchained.ethereum.V1Api
      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const tx = {
        wallet: await getWallet(),
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          value: '0x0',
          to: EOA_ADDRESS,
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: 'notHexString',
          nonce: '0x0',
          gasPrice: '0x29d41057e0',
          gasLimit: '0xc9df',
        },
      } as unknown as SignTxInput<ETHSignTx>

      await expect(adapter.signTransaction(tx)).rejects.toThrow(/invalid hexlify value/)
    })
  })

  describe('signAndBroadcastTransaction', () => {
    it('should throw if no hash is returned by wallet.ethSendTx', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const wallet = await getWallet()

      wallet.ethSendTx = async () => await Promise.resolve(null)

      const tx = { wallet, txToSign: {} } as unknown as SignTxInput<ETHSignTx>

      await expect(adapter.signAndBroadcastTransaction(tx)).rejects.toThrow(
        /Error signing & broadcasting tx/,
      )
    })

    it('should return the hash returned by wallet.ethSendTx', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const wallet = await getWallet()

      wallet.ethSendTx = async () =>
        await Promise.resolve({
          hash: '0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331',
        })

      const tx = { wallet, txToSign: {} } as unknown as SignTxInput<ETHSignTx>

      await expect(adapter.signAndBroadcastTransaction(tx)).resolves.toEqual(
        '0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331',
      )
    })
  })

  describe('signMessage', () => {
    it('should sign a properly formatted signMessageInput object', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const wallet = await getWallet()

      const message: SignMessageInput<ETHSignMessage> = {
        wallet,
        messageToSign: {
          message: 'Hello world 111',
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
        },
      }

      await expect(adapter.signMessage(message)).resolves.toEqual(
        '0x05a0edb4b98fe6b6ed270bf55aef84ddcb641512e19e340bf9eed3427854a7a4734fe45551dc24f1843cf2c823a73aa2454e3785eb15120573c522cc114e472d1c',
      )
    })

    it('should throw if wallet.ethSignMessage returns null', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())
      const wallet = await getWallet()

      wallet.ethSignMessage = async () => await Promise.resolve(null)

      const message: SignMessageInput<ETHSignMessage> = {
        wallet,
        messageToSign: {
          message: 'Hello world 111',
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
        },
      }

      await expect(adapter.signMessage(message)).rejects.toThrow(
        /EvmBaseAdapter: error signing message/,
      )
    })
  })

  describe('broadcastTransaction', () => {
    it('should correctly call sendTx and return its response', async () => {
      const expectedResult = 'success'

      const httpProvider = {
        sendTx: jest.fn().mockResolvedValue(expectedResult),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const mockTx = '0x123'
      const result = await adapter.broadcastTransaction(mockTx)

      expect(args.providers.http.sendTx).toHaveBeenCalledWith<any>({ sendTxBody: { hex: mockTx } })
      expect(result).toEqual(expectedResult)
    })
  })

  describe('buildSendTransaction', () => {
    it('should throw if passed tx has no "to" property', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())

      const tx = {
        wallet: await getWallet(),
        value,
        chainSpecific: makeChainSpecific({ tokenContractAddress }),
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).rejects.toThrow(
        `${adapter.getName()}ChainAdapter: to is required`,
      )
    })

    it('should throw if passed tx has ENS as "to" property', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(
            makeGetAccountMockResponse({ balance: '2500000', tokenBalance: '424242' }),
          ),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: ENS_NAME,
        value,
        chainSpecific: makeChainSpecific({ tokenContractAddress }),
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).rejects.toThrow(
        /a provider or signer is needed to resolve ENS names/,
      )
    })

    it('should throw if passed tx has no "value" property', async () => {
      const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())

      const tx = {
        wallet: await getWallet(),
        to: EOA_ADDRESS,
        chainSpecific: makeChainSpecific(),
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).rejects.toThrow(
        `${adapter.getName()}ChainAdapter: value is required`,
      )
    })

    it('should return a validly formatted ETHSignTx object for a valid BuildSendTxInput parameter', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(makeGetAccountMockResponse({ balance: '0', tokenBalance: '424242' })),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: EOA_ADDRESS,
        value,
        chainSpecific: makeChainSpecific(),
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).resolves.toStrictEqual({
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '',
          gasLimit: numberToHex(gasLimit),
          gasPrice: numberToHex(gasPrice),
          nonce: '0x2',
          to: EOA_ADDRESS,
          value: numberToHex(value),
        },
      })

      expect(args.providers.http.getAccount).toHaveBeenCalledTimes(1)
    })

    it('sendmax: true without chainSpecific.tokenContractAddress should throw if balance is 0', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(makeGetAccountMockResponse({ balance: '0', tokenBalance: '424242' })),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: EOA_ADDRESS,
        value,
        chainSpecific: makeChainSpecific(),
        sendMax: true,
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).rejects.toThrow('no balance')
      expect(args.providers.http.getAccount).toHaveBeenCalledTimes(1)
    })
    it('sendMax: true without chainSpecific.tokenContractAddress - should build a tx with full account balance - gas fee', async () => {
      const balance = '2500000'
      const expectedValue = numberToHex(
        bn(balance).minus(bn(gasLimit).multipliedBy(gasPrice)) as any,
      )
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(makeGetAccountMockResponse({ balance, tokenBalance: '424242' })),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: EOA_ADDRESS,
        value,
        chainSpecific: makeChainSpecific(),
        sendMax: true,
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).resolves.toStrictEqual({
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '',
          gasLimit: numberToHex(gasLimit),
          gasPrice: numberToHex(gasPrice),
          nonce: '0x2',
          to: EOA_ADDRESS,
          value: expectedValue,
        },
      })

      expect(args.providers.http.getAccount).toHaveBeenCalledTimes(1)
    })

    it("should build a tx with value: '0' for ERC20 txs without sendMax", async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(
            makeGetAccountMockResponse({ balance: '2500000', tokenBalance: '424242' }),
          ),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: ZERO_ADDRESS,
        value,
        chainSpecific: makeChainSpecific({ tokenContractAddress }),
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).resolves.toStrictEqual({
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '0xa9059cbb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000190',
          gasLimit: numberToHex(gasLimit),
          gasPrice: numberToHex(gasPrice),
          nonce: '0x2',
          to: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
          value: '0x0',
        },
      })

      expect(args.providers.http.getAccount).toHaveBeenCalledTimes(1)
    })

    it('sendmax: true with chainSpecific.tokenContractAddress should build a tx with full account balance - gas fee', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(
            makeGetAccountMockResponse({ balance: '2500000', tokenBalance: '424242' }),
          ),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: EOA_ADDRESS,
        value,
        chainSpecific: makeChainSpecific({ tokenContractAddress }),
        sendMax: true,
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).resolves.toStrictEqual({
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000000000000067932',
          gasLimit: numberToHex(gasLimit),
          gasPrice: numberToHex(gasPrice),
          nonce: '0x2',
          to: '0xc770eefad204b5180df6a14ee197d99d808ee52d',
          value: '0x0',
        },
      })

      expect(args.providers.http.getAccount).toHaveBeenCalledTimes(1)
    })

    it('sendmax: true with chainSpecific.tokenContractAddress should throw if token balance is 0', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(
            makeGetAccountMockResponse({ balance: '2500000', tokenBalance: undefined }),
          ),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)
      const accountNumber = 0

      const tx = {
        accountNumber,
        wallet: await getWallet(),
        to: EOA_ADDRESS,
        value,
        chainSpecific: makeChainSpecific({ tokenContractAddress }),
        sendMax: true,
      } as unknown as BuildSendTxInput<KnownChainIds.EthereumMainnet>

      await expect(adapter.buildSendTransaction(tx)).rejects.toThrow('no balance')

      expect(args.providers.http.getAccount).toHaveBeenCalledTimes(1)
    })
  })

  describe('buildCustomTx', () => {
    it('should build an unsigned custom tx using gasPrice', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(
            makeGetAccountMockResponse({ balance: '2500000', tokenBalance: undefined }),
          ),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const txArgs = {
        wallet: await getWallet(),
        accountNumber: 0,
        to: `0x47CB53752e5dc0A972440dA127DCA9FBA6C2Ab6F`,
        data: '0x420',
        value: '123',
        gasPrice: '123',
        gasLimit: '456',
      }

      const output = await adapter.buildCustomTx(txArgs)

      const expectedOutput = {
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          value: '0x7b',
          to: '0x47CB53752e5dc0A972440dA127DCA9FBA6C2Ab6F',
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '0x420',
          nonce: '0x2',
          gasLimit: '0x1c8',
          gasPrice: '0x7b',
        },
      }

      expect(expectedOutput).toEqual(output)
    })

    it('should build an unsigned custom tx using maxFeePerGas & maxPriorityFeePerGas (eip1559)', async () => {
      const httpProvider = {
        getAccount: jest
          .fn<any, any>()
          .mockResolvedValue(
            makeGetAccountMockResponse({ balance: '2500000', tokenBalance: undefined }),
          ),
      } as unknown as unchained.ethereum.V1Api

      const args = makeChainAdapterArgs({ providers: { http: httpProvider } })
      const adapter = new ethereum.ChainAdapter(args)

      const txArgs = {
        wallet: await getWallet(),
        accountNumber: 0,
        to: `0x47CB53752e5dc0A972440dA127DCA9FBA6C2Ab6F`,
        data: '0x420',
        value: '123',
        gasLimit: '456',
        maxFeePerGas: '421',
        maxPriorityFeePerGas: '422',
      }

      const output = await adapter.buildCustomTx(txArgs)

      const expectedOutput = {
        txToSign: {
          addressNList: toAddressNList(adapter.getBIP44Params({ accountNumber: 0 })),
          value: '0x7b',
          to: '0x47CB53752e5dc0A972440dA127DCA9FBA6C2Ab6F',
          chainId: Number(CHAIN_REFERENCE.EthereumMainnet),
          data: '0x420',
          nonce: '0x2',
          gasLimit: '0x1c8',
          maxFeePerGas: '0x1a5',
          maxPriorityFeePerGas: '0x1a6',
        },
      }

      expect(expectedOutput).toEqual(output)
    })
  })

  describe('getBIP44Params', () => {
    const adapter = new ethereum.ChainAdapter(makeChainAdapterArgs())

    it('should return the correct coinType', () => {
      const result = adapter.getBIP44Params({ accountNumber: 0 })
      expect(result.coinType).toStrictEqual(Number(ASSET_REFERENCE.Ethereum))
    })

    it('should respect accountNumber', () => {
      const testCases: BIP44Params[] = [
        { purpose: 44, coinType: Number(ASSET_REFERENCE.Ethereum), accountNumber: 0 },
        { purpose: 44, coinType: Number(ASSET_REFERENCE.Ethereum), accountNumber: 1 },
        { purpose: 44, coinType: Number(ASSET_REFERENCE.Ethereum), accountNumber: 2 },
      ]

      testCases.forEach(expected => {
        const result = adapter.getBIP44Params({ accountNumber: expected.accountNumber })
        expect(result).toStrictEqual(expected)
      })
    })

    it('should throw for negative accountNumber', () => {
      expect(() => {
        adapter.getBIP44Params({ accountNumber: -1 })
      }).toThrow('accountNumber must be >= 0')
    })
  })
})
