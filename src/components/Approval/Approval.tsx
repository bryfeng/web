import {
  Box,
  Button,
  Divider,
  Flex,
  Icon,
  Image,
  Link,
  SkeletonCircle,
  Switch,
  Text as CText,
  Tooltip,
} from '@chakra-ui/react'
import { ethAssetId } from '@shapeshiftoss/caip'
import type { EvmChainId } from '@shapeshiftoss/chain-adapters'
import { useCallback, useRef, useState } from 'react'
import { CountdownCircleTimer } from 'react-countdown-circle-timer'
import { useFormContext } from 'react-hook-form'
import { FaInfoCircle } from 'react-icons/fa'
import { useTranslate } from 'react-polyglot'
import { useHistory } from 'react-router-dom'
import { Card } from 'components/Card/Card'
import { MiddleEllipsis } from 'components/MiddleEllipsis/MiddleEllipsis'
import { Row } from 'components/Row/Row'
import { SlideTransition } from 'components/SlideTransition'
import { RawText, Text } from 'components/Text'
import { useSwapper } from 'components/Trade/hooks/useSwapper/useSwapper'
import type { DisplayFeeData } from 'components/Trade/types'
import { TradeRoutePaths } from 'components/Trade/types'
import { WalletActions } from 'context/WalletProvider/actions'
import { useErrorHandler } from 'hooks/useErrorToast/useErrorToast'
import { useLocaleFormatter } from 'hooks/useLocaleFormatter/useLocaleFormatter'
import { useWallet } from 'hooks/useWallet/useWallet'
import { baseUnitToHuman, bnOrZero } from 'lib/bignumber/bignumber'
import { logger } from 'lib/logger'
import { selectFeeAssetById } from 'state/slices/selectors'
import { useAppSelector } from 'state/store'
import {
  selectCheckApprovalNeededForWallet,
  selectFeeAssetFiatRate,
  selectFees,
  selectIsExactAllowance,
  selectQuote,
} from 'state/zustand/swapperStore/selectors'
import { useSwapperStore } from 'state/zustand/swapperStore/useSwapperStore'
import { theme } from 'theme/theme'

const APPROVAL_PERMISSION_URL = 'https://shapeshift.zendesk.com/hc/en-us/articles/360018501700'

const moduleLogger = logger.child({ namespace: ['Approval'] })

export const Approval = () => {
  const history = useHistory()
  const approvalInterval: { current: NodeJS.Timeout | undefined } = useRef()
  const [approvalTxId, setApprovalTxId] = useState<string>()
  const translate = useTranslate()
  const wallet = useWallet().state.wallet

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useFormContext()

  const activeQuote = useSwapperStore(selectQuote)
  const feeAssetFiatRate = useSwapperStore(selectFeeAssetFiatRate)
  const isExactAllowance = useSwapperStore(selectIsExactAllowance)
  const toggleIsExactAllowance = useSwapperStore(state => state.toggleIsExactAllowance)
  const fees = useSwapperStore(selectFees) as DisplayFeeData<EvmChainId> | undefined
  const updateTrade = useSwapperStore(state => state.updateTrade)
  const checkApprovalNeeded = useSwapperStore(selectCheckApprovalNeededForWallet)

  const { approve, getTrade } = useSwapper()
  const {
    number: { toCrypto, toFiat },
  } = useLocaleFormatter()
  const {
    state: { isConnected },
    dispatch,
  } = useWallet()
  const { showErrorToast } = useErrorHandler()

  const symbol = activeQuote?.sellAsset?.symbol
  const sellFeeAsset = useAppSelector(state =>
    selectFeeAssetById(state, activeQuote?.sellAsset?.assetId ?? ethAssetId),
  )

  if (fees && !fees.chainSpecific) {
    moduleLogger.debug({ fees }, 'chainSpecific undefined for fees')
  }

  const approvalFeeCryptoHuman = baseUnitToHuman({
    value: bnOrZero(fees?.chainSpecific?.approvalFeeCryptoBaseUnit),
    inputExponent: sellFeeAsset?.precision ?? 0,
  })

  const approveContract = useCallback(async () => {
    if (!activeQuote) {
      moduleLogger.error('No quote available')
      return
    }
    if (!wallet) {
      moduleLogger.error('No wallet available')
      return
    }
    try {
      if (!isConnected) {
        /**
         * call history.goBack() to reset current form state
         * before opening the connect wallet modal.
         */
        history.goBack()
        dispatch({ type: WalletActions.SET_WALLET_MODAL, payload: true })
        return
      }
      const fnLogger = logger.child({ name: 'approve' })
      fnLogger.trace('Attempting Approval...')

      const txId = await approve()

      setApprovalTxId(txId)

      approvalInterval.current = setInterval(async () => {
        fnLogger.trace({ fn: 'checkApprovalNeeded' }, 'Checking Approval Needed...')
        try {
          const approvalNeeded = await checkApprovalNeeded(wallet)
          if (approvalNeeded) return
        } catch (e) {
          showErrorToast(e)
          approvalInterval.current && clearInterval(approvalInterval.current)
          return history.push(TradeRoutePaths.Input)
        }
        approvalInterval.current && clearInterval(approvalInterval.current)

        const trade = await getTrade()
        if (trade.isErr()) {
          // Actually throw so we can catch the error and show the error toast
          throw new Error(trade.unwrapErr().message)
        }
        updateTrade(trade.unwrap())
        history.push({ pathname: TradeRoutePaths.Confirm })
      }, 5000)
    } catch (e) {
      showErrorToast(e)
    }
  }, [
    activeQuote,
    wallet,
    isConnected,
    approve,
    history,
    dispatch,
    getTrade,
    updateTrade,
    checkApprovalNeeded,
    showErrorToast,
  ])

  return (
    <SlideTransition>
      <Card variant='unstyled'>
        <Card.Header textAlign='center' px={0} pt={0}>
          <Card.Heading>
            <Text translation='assets.assetCards.assetActions.trade' />
          </Card.Heading>
        </Card.Header>
        <Card.Body pb={0} px={0}>
          <Flex
            justifyContent='center'
            alignItems='center'
            flexDirection='column'
            width='full'
            as='form'
            onSubmit={handleSubmit(approveContract)}
          >
            <CountdownCircleTimer
              isPlaying={!!approvalTxId || isSubmitting}
              size={90}
              strokeWidth={6}
              trailColor={theme.colors.whiteAlpha[500]}
              duration={60}
              colors={theme.colors.blue[500]}
              onComplete={() => ({ shouldRepeat: true })}
            >
              {() => (
                <Image
                  src={activeQuote?.sellAsset?.icon}
                  boxSize='60px'
                  fallback={<SkeletonCircle boxSize='60px' />}
                />
              )}
            </CountdownCircleTimer>
            <Text
              my={2}
              fontSize='lg'
              fontWeight='bold'
              textAlign='center'
              translation={['trade.approveAsset', { symbol }]}
            />
            <CText color='gray.500' textAlign='center'>
              <Link
                href={`${activeQuote?.sellAsset.explorerAddressLink}${activeQuote?.allowanceContract}`}
                color='blue.500'
                me={1}
                isExternal
              >
                {fees?.tradeFeeSource}
              </Link>
              {translate('trade.needPermission', { symbol })}
            </CText>
            <Link isExternal color='blue.500' href={APPROVAL_PERMISSION_URL}>
              <Text color='blue.500' translation='trade.whyNeedThis' />
            </Link>
            <Divider my={4} />
            <Flex flexDirection='column' width='full'>
              {approvalTxId && activeQuote?.sellAsset?.explorerTxLink && (
                <Row>
                  <Row.Label>
                    <Text translation={['trade.approvingAsset', { symbol }]} />
                  </Row.Label>
                  <Row.Value>
                    <Link
                      isExternal
                      color='blue.500'
                      href={`${activeQuote?.sellAsset?.explorerTxLink}${approvalTxId}`}
                    >
                      <MiddleEllipsis value={approvalTxId} />
                    </Link>
                  </Row.Value>
                </Row>
              )}
              <Row>
                <Row.Label display='flex' alignItems='center'>
                  <Text color='gray.500' translation='trade.allowance' />
                  <Tooltip label={translate('trade.allowanceTooltip')}>
                    <Box ml={1}>
                      <Icon as={FaInfoCircle} color='gray.500' fontSize='0.7em' />
                    </Box>
                  </Tooltip>
                </Row.Label>
                <Row.Value textAlign='right' display='flex' alignItems='center'>
                  <Text
                    color={isExactAllowance ? 'gray.500' : 'white'}
                    translation='trade.unlimited'
                    fontWeight='bold'
                  />
                  <Switch
                    size='sm'
                    mx={2}
                    isChecked={isExactAllowance}
                    onChange={toggleIsExactAllowance}
                  />
                  <Text
                    color={isExactAllowance ? 'white' : 'gray.500'}
                    translation='trade.exact'
                    fontWeight='bold'
                  />
                </Row.Value>
              </Row>
              <Button
                type='submit'
                size='lg'
                isLoading={isSubmitting || !!approvalTxId}
                colorScheme='blue'
                mt={2}
              >
                <Text translation='common.confirm' />
              </Button>
              {!approvalTxId && !isSubmitting && (
                <Button variant='ghost' mt={2} size='lg' onClick={() => history.goBack()}>
                  <Text translation='common.reject' />
                </Button>
              )}
              <Divider my={4} />
              <Row>
                <Row.Label>
                  <Text color='gray.500' translation='trade.estimatedGasFee' />
                </Row.Label>
                <Row.Value textAlign='right'>
                  <RawText>
                    {toFiat(approvalFeeCryptoHuman.times(feeAssetFiatRate ?? 1).toString())}
                  </RawText>
                  <RawText color='gray.500'>
                    {toCrypto(approvalFeeCryptoHuman.toNumber(), sellFeeAsset?.symbol)}
                  </RawText>
                </Row.Value>
              </Row>
            </Flex>
          </Flex>
        </Card.Body>
      </Card>
    </SlideTransition>
  )
}
