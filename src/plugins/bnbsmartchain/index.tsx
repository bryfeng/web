import type { ChainId } from '@shapeshiftoss/caip'
import type { ChainAdapter } from '@shapeshiftoss/chain-adapters'
import { bnbsmartchain } from '@shapeshiftoss/chain-adapters'
import { KnownChainIds } from '@shapeshiftoss/types'
import * as unchained from '@shapeshiftoss/unchained-client'
import { getConfig } from 'config'
import { type Plugins } from 'plugins/types'

// eslint-disable-next-line import/no-default-export
export default function register(): Plugins {
  return [
    [
      'bscChainAdapter',
      {
        name: 'bscChainAdapter',
        featureFlag: ['BnbSmartChain', 'ZrxBnbSmartChainSwap'],
        providers: {
          chainAdapters: [
            [
              KnownChainIds.BnbSmartChainMainnet,
              () => {
                const http = new unchained.bnbsmartchain.V1Api(
                  new unchained.bnbsmartchain.Configuration({
                    basePath: getConfig().REACT_APP_UNCHAINED_BNBSMARTCHAIN_HTTP_URL,
                  }),
                )

                const ws = new unchained.ws.Client<unchained.bnbsmartchain.Tx>(
                  getConfig().REACT_APP_UNCHAINED_BNBSMARTCHAIN_WS_URL,
                )

                return new bnbsmartchain.ChainAdapter({
                  providers: { http, ws },
                  rpcUrl: getConfig().REACT_APP_BNBSMARTCHAIN_NODE_URL,
                }) as unknown as ChainAdapter<ChainId> // FIXME: this is silly
              },
            ],
          ],
        },
      },
    ],
  ]
}
