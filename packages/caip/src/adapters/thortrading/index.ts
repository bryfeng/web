import invert from 'lodash/invert'

import type { AssetId } from '../../assetId/assetId'
import {
  avalancheAssetId,
  bchAssetId,
  binanceAssetId,
  btcAssetId,
  cosmosAssetId,
  dogeAssetId,
  ethAssetId,
  ltcAssetId,
} from '../../constants'

// derived from https://midgard.thorchain.info/v2/pools
// Rarely changes. Will need to be updated as we add additional assets to thor swapper
const thorPoolIdAssetIdSymbolMap: Record<string, AssetId> = {
  'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E':
    'eip155:1/erc20:0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
  'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C':
    'eip155:1/erc20:0x69fa0fee221ad11012bab0fdb45d444d3d2ce71c',
  'ETH.XDEFI-0X72B886D09C117654AB7DA13A14D603001DE0B777':
    'eip155:1/erc20:0x72b886d09c117654ab7da13a14d603001de0b777',
  'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599':
    'eip155:1/erc20:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7':
    'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
  'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48':
    'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  'ETH.UOS-0XD13C7342E1EF687C5AD21B27C2B65D772CAB5C8C':
    'eip155:1/erc20:0xd13c7342e1ef687c5ad21b27c2b65d772cab5c8c',
  'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044':
    'eip155:1/erc20:0xa5f2211b9b8170f694421f2046281775e8468044',
  'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325':
    'eip155:1/erc20:0x108a850856db3f85d0269a2693d896b394c80325',
  'ETH.SUSHI-0X6B3595068778DD592E39A122F4F5A5CF09C90FE2':
    'eip155:1/erc20:0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
  'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F':
    'eip155:1/erc20:0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
  'ETH.RAZE-0X5EAA69B29F99C84FE5DE8200340B4E9B4AB38EAC"':
    'eip155:1/erc20:0x5eaa69b29f99c84fe5de8200340b4e9b4ab38eac',
  'ETH.PERP-0XBC396689893D065F41BC2C6ECBEE5E0085233447':
    'eip155:1/erc20:0xbc396689893d065f41bc2c6ecbee5e0085233447',
  'ETH.KYL-0X67B6D479C7BB412C54E03DCA8E1BC6740CE6B99C':
    'eip155:1/erc20:0x67b6d479c7bb412c54e03dca8e1bc6740ce6b99c',
  'ETH.HOT-0X6C6EE5E31D828DE241282B9606C8E98EA48526E2':
    'eip155:1/erc20:0x6c6ee5e31d828de241282b9606c8e98ea48526e2',
  'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D':
    'eip155:1/erc20:0xc770eefad204b5180df6a14ee197d99d808ee52d',
  'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F':
    'eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f',
  'ETH.CREAM-0X2BA592F78DB6436527729929AAF6C908497CB200':
    'eip155:1/erc20:0x2ba592f78db6436527729929aaf6c908497cb200',
  'ETH.ALPHA-0XA1FAA113CBE53436DF28FF0AEE54275C13B40975':
    'eip155:1/erc20:0xa1faa113cbe53436df28ff0aee54275c13b40975',
  'ETH.ALCX-0XDBDB4D16EDA451D0503B854CF79D55697F90C8DF':
    'eip155:1/erc20:0xdbdb4d16eda451d0503b854cf79d55697f90c8df',
  'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9':
    'eip155:1/erc20:0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  'BTC.BTC': btcAssetId,
  'ETH.ETH': ethAssetId,
  'LTC.LTC': ltcAssetId,
  'DOGE.DOGE': dogeAssetId,
  'GAIA.ATOM': cosmosAssetId,
  'BCH.BCH': bchAssetId,
  'AVAX.AVAX': avalancheAssetId,
  'BNB.BNB': binanceAssetId,
  'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E':
    'eip155:43114/erc20:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
}

const assetIdToPoolAssetIdMap = invert(thorPoolIdAssetIdSymbolMap)

export const poolAssetIdToAssetId = (id: string): AssetId | undefined =>
  thorPoolIdAssetIdSymbolMap[id.toUpperCase()]

export const assetIdToPoolAssetId = ({ assetId }: { assetId: AssetId }): string | undefined =>
  assetIdToPoolAssetIdMap[assetId.toLowerCase()]
