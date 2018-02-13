import { Alert, Platform } from 'react-native'
import { NavigationActions } from 'react-navigation'
import { delay } from 'redux-saga'
import { all, call, put, select, takeLatest } from 'redux-saga/effects'
import accounting from 'accounting'
import getSymbolFromCurrency from 'currency-symbol-map'
import BTClient from 'react-native-braintree-xplat'
import { fetchCase } from '../../Home/modules/Cases'
import { showLoader, dismissLoader } from '../../../modules/App'
import { trackEvent } from '../../../services/analytics'
import I18n from '../../../services/i18n'
import apiClient from '../../../services/api'
import sagasManager from '../../../services/sagasManager'
import resolveCurrency from '../../../services/resolveCurrency'
import config from '../../../config'

export const extractPrice = (amount, currencyCode) => {
  let format = '%s%v'

  let symbol = getSymbolFromCurrency(currencyCode)
  if (!symbol) {
    format = '%v %s'
    symbol = currencyCode
  }

  return accounting.formatMoney(amount, { symbol, format })
}

export const transformPrices = prices =>
  prices
    .sort((a, b) => {
      if (a.responseHours > b.responseHours) return 1
      if (a.responseHours < b.responseHours) return -1
      return 0
    })
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sku: p.sku,
      amount: p.amount,
      currency: p.currency,
      responseHours: p.responseHours,
      prettyPrice: extractPrice(p.amount, p.currency)
    }))

export const paymentOptions = [
  { type: 'creditcard', name: 'Payment.Creditcard' },
  { type: 'paypal', name: 'Payment.Paypal' },
  { type: 'hsa', name: 'Payment.Hsa' },
  { type: 'promocode', name: 'Payment.PromoCode' }
]

// ------------------------------------
// Constants
// ------------------------------------
export const CLEAR = 'payment/CLEAR'
export const SET_ACTIVE_SKU = 'payment/SET_ACTIVE_SKU'
export const SET_PAYMENT_OPTION = 'payment/SET_PAYMENT_OPTION'
export const SET_PROMOCODE = 'payment/SET_PROMOCODE'
export const LOAD_PRICES = 'payment/LOAD_PRICES'
export const LOAD_PRICES_BEGIN = 'payment/LOAD_PRICES_BEGIN'
export const LOAD_PRICES_SUCCESS = 'payment/LOAD_PRICES_SUCCESS'
export const LOAD_PRICES_ERROR = 'payment/LOAD_PRICES_ERROR'

export const REQUEST_PAYMENT = 'payment/REQUEST_PAYMENT'
export const REQUEST_PAYMENT_BEGIN = 'payment/REQUEST_PAYMENT_BEGIN'
export const REQUEST_PAYMENT_SUCCESS = 'payment/REQUEST_PAYMENT_SUCCESS'
export const REQUEST_PAYMENT_ERROR = 'payment/REQUEST_PAYMENT_ERROR'

export const CHECK_PROMOCODE = 'payment/CHECK_PROMOCODE'
export const CHECK_PROMOCODE_BEGIN = 'payment/CHECK_PROMOCODE_BEGIN'
export const CHECK_PROMOCODE_SUCCESS = 'payment/CHECK_PROMOCODE_SUCCESS'
export const CHECK_PROMOCODE_ERROR = 'payment/CHECK_PROMOCODE_ERROR'

// ------------------------------------
// Actions
// ------------------------------------

export const clear = () => ({
  type: CLEAR
})

export const setActiveSku = activeSku => ({
  type: SET_ACTIVE_SKU,
  payload: activeSku
})

export const setPaymentOption = paymentOption => ({
  type: SET_PAYMENT_OPTION,
  payload: paymentOption
})

export const setPromocode = promocode => ({
  type: SET_PROMOCODE,
  payload: promocode
})

export const loadPrices = () => ({
  type: LOAD_PRICES
})

export const requestPayment = () => ({
  type: REQUEST_PAYMENT
})

export const checkPromocode = () => ({
  type: CHECK_PROMOCODE
})

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [CLEAR]: (state, action) => ({ ...initialState, prices: state.prices }),
  [SET_ACTIVE_SKU]: (state, action) => ({
    ...state,
    activeSku: action.payload
  }),
  [SET_PAYMENT_OPTION]: (state, action) => ({
    ...state,
    paymentOption: action.payload
  }),
  [SET_PROMOCODE]: (state, action) => ({
    ...state,
    needCheckPromocode: !!action.payload,
    validationPromocode: false,
    isValidPromocode: false,
    promocode: action.payload
  }),
  [LOAD_PRICES_BEGIN]: (state, action) => ({
    ...state,
    loadingPrices: true,
    pricesLoaded: false
  }),
  [LOAD_PRICES_SUCCESS]: (state, action) => ({
    ...state,
    prices: action.payload.prices,
    loadingPrices: false,
    pricesLoaded: true
  }),
  [LOAD_PRICES_ERROR]: (state, action) => ({
    ...state,
    loadingPrices: false,
    error: action.payload.error
  }),
  [REQUEST_PAYMENT_BEGIN]: (state, action) => ({
    ...state,
    processPayment: true,
    paid: false
  }),
  [REQUEST_PAYMENT_SUCCESS]: (state, action) => ({
    ...state,
    processPayment: false,
    paid: true
  }),
  [REQUEST_PAYMENT_ERROR]: (state, action) => ({
    ...state,
    processPayment: false,
    paid: false
  }),
  [CHECK_PROMOCODE_BEGIN]: (state, action) => ({
    ...state,
    isValidPromocode: false,
    validationPromocode: true
  }),
  [CHECK_PROMOCODE_SUCCESS]: (state, action) => ({
    ...state,
    activeSku: 'derm24h',
    needCheckPromocode: false,
    isValidPromocode: true,
    validationPromocode: false
  }),
  [CHECK_PROMOCODE_ERROR]: (state, action) => ({
    ...state,
    needCheckPromocode: false,
    isValidPromocode: false,
    validationPromocode: false
  })
}

// ------------------------------------
// Reducer
// ------------------------------------
const initialState = {
  activeSku: null,
  paymentOption: 'creditcard',
  loadingPrices: false,
  pricesLoaded: false,
  promocode: null,
  needCheckPromocode: false,
  validationPromocode: false,
  isValidPromocode: false,
  paymentRequestId: null,
  paymentToken: null,
  processPayment: false,
  paid: false,
  prices: {
    prices: []
  }
}

export default function (state = initialState, action) {
  const handler = ACTION_HANDLERS[action.type]
  return handler ? handler(state, action) : state
}

// ------------------------------------
// Selectors
// ------------------------------------
export const getAppConfig = state => state.App.config
export const getPromocode = state => state.Payment.promocode
export const getSelectedPrice = state => {
  const activeSku = state.Payment.activeSku
  return state.Payment.prices.prices.find(p => p.sku === activeSku)
}
export const getTheCase = state => state.NewCase.theCase
export const getPayment = state => state.Payment
// ------------------------------------
// Sagas
// ------------------------------------
export function * loadPricesSaga () {
  try {
    yield put({ type: LOAD_PRICES_BEGIN })
    const { culture, priceListId } = yield select(getAppConfig)
    let resolvedCurrency = null
    try {
      const result = yield call(resolveCurrency, config.bundleId)
      console.log(`resolveCurrency(${config.bundleId}) RESULT:`, result)
      resolvedCurrency = result
    } catch (error) {
      console.log(`resolveCurrency(${config.bundleId}) ERROR:`, error)
    }

    console.log('Begin prices call')
    const result = yield call(
      [apiClient, apiClient.prices],
      priceListId,
      culture,
      resolvedCurrency
    )
    console.log(
      `Price result for prices(${priceListId}, ${culture}, ${resolvedCurrency}) Result:`,
      result
    )
    const prices = {
      ...result,
      prices: transformPrices(result.prices)
    }
    yield put({ type: LOAD_PRICES_SUCCESS, payload: { prices } })
  } catch (error) {
    // console.log(
    //   `Price result for prices(${priceListId}, ${culture}, ${resolvedCurrency}) Error: ${error}`
    // )
    yield put({ type: LOAD_PRICES_ERROR, payload: { error } })
    yield call(Alert.alert, 'Error', I18n.t('ErrorMessages.LoadPriceList'))
  }
}

export function * checkPromocodeSaga () {
  try {
    yield put({ type: CHECK_PROMOCODE_BEGIN })
    const promocode = yield select(getPromocode)
    const result = yield call([apiClient, apiClient.checkPromocode], promocode)
    if (result) {
      yield put({ type: CHECK_PROMOCODE_SUCCESS })
    } else {
      yield put({ type: CHECK_PROMOCODE_ERROR })
    }
  } catch (error) {
    yield put({ type: CHECK_PROMOCODE_ERROR })
  }
}

export function * requestPaymentSaga () {
  try {
    yield put({ type: REQUEST_PAYMENT_BEGIN })
    yield put(showLoader(I18n.t('Message.CreatingPayment')))
    const price = yield select(getSelectedPrice)
    const { id: caseId, caseCode } = yield select(getTheCase)
    const {
      paymentOption,
      promocode,
      needCheckPromocode,
      isValidPromocode
    } = yield select(getPayment)
    if (
      paymentOption === 'promocode' &&
      isValidPromocode &&
      !needCheckPromocode
    ) {
      const applyPromocodeResult = yield call(
        [apiClient, apiClient.applyPromocode],
        caseCode,
        promocode
      )
      if (applyPromocodeResult.FullyPaid) {
        yield put({
          type: REQUEST_PAYMENT_SUCCESS,
          payload: applyPromocodeResult
        })
        trackEvent('ecommerce_purchase', {
          currency: price.currency,
          value: price.amount
        })
        yield put(fetchCase(caseCode))
        yield put(
          NavigationActions.navigate({
            routeName: 'PaymentSuccess',
            params: { caseCode, responseHours: price.responseHours }
          })
        )
      } else {
        const paymentRequest = yield call(
          [apiClient, apiClient.paymentRequestCreate],
          caseId,
          price.id
        )

        console.log('setting up braintree')
        if (Platform.OS === 'ios') {
          yield call(
            [BTClient, BTClient.setupWithURLScheme],
            paymentRequest.token,
            `${config.bundleId}.payments`
          )
        } else {
          yield call([BTClient, BTClient.setup], paymentRequest.token)
        }
        console.log('done setting up, fetching payment request')
        const paymentNonce = yield call(
          [BTClient, BTClient.showPaymentViewController],
          {}
        )

        const paymentCommitResult = yield call(
          [apiClient, apiClient.paymentCommit],
          paymentRequest.paymentRequestId,
          paymentNonce
        )
        if (paymentCommitResult) {
          yield put({
            type: REQUEST_PAYMENT_SUCCESS,
            payload: paymentCommitResult
          })
          trackEvent('ecommerce_purchase', {
            currency: price.currency,
            value: price.amount
          })
          yield put(fetchCase(caseCode))
          yield put(
            NavigationActions.navigate({
              routeName: 'PaymentSuccess',
              params: { caseCode, responseHours: price.responseHours }
            })
          )
        } else {
          yield call(
            [Alert, Alert.alert],
            'Error',
            I18n.t('ErrorMessages.CommitPayment')
          )
          yield put({ type: REQUEST_PAYMENT_ERROR })
        }
      }
    } else {
      const paymentRequest = yield call(
        [apiClient, apiClient.paymentRequestCreate],
        caseId,
        price.id
      )
      console.log('paymentRequest result', paymentRequest)
      if (Platform.OS === 'ios') {
        yield call(
          [BTClient, BTClient.setupWithURLScheme],
          paymentRequest.token,
          `${config.bundleId}.payments`
        )
      } else {
        yield call([BTClient, BTClient.setup], paymentRequest.token)
      }
      yield delay(3000) // Hack to avoid timing issue, see https://github.com/kraffslol/react-native-braintree-xplat/issues/21
      console.log('done setting up BT Client')
      let paymentNonce
      if (paymentOption === 'creditcard' || paymentOption === 'hsa') {
        paymentNonce = yield call(
          [BTClient, BTClient.showPaymentViewController],
          {}
        )
      } else {
        paymentNonce = yield call(
          [BTClient, BTClient.showPayPalViewController],
          {}
        )
      }

      console.log('payment nonce is', paymentNonce)

      const paymentCommitResult = yield call(
        [apiClient, apiClient.paymentCommit],
        paymentRequest.paymentRequestId,
        paymentNonce
      )

      console.log('payment commit result is', paymentCommitResult)
      if (paymentCommitResult) {
        yield put({
          type: REQUEST_PAYMENT_SUCCESS,
          payload: paymentCommitResult
        })
        yield put(fetchCase(caseCode))
        yield put(
          NavigationActions.navigate({
            routeName: 'PaymentSuccess',
            params: { caseCode, responseHours: price.responseHours }
          })
        )
      } else {
        yield call(
          [Alert, Alert.alert],
          'Error',
          I18n.t('ErrorMessages.CommitPayment')
        )
        yield put({ type: REQUEST_PAYMENT_ERROR })
      }
    }
    yield put(dismissLoader())
  } catch (error) {
    yield put(dismissLoader())
    yield put({ type: REQUEST_PAYMENT_ERROR, payload: { error } })
    if (error !== 'User cancelled payment' && error !== 'Canceled') {
      yield call(
        [Alert, Alert.alert],
        'Error',
        I18n.t('ErrorMessages.CreatePayment')
      )
    }
    console.log('Error', error)
  }
}

export function * watcher () {
  yield all([
    takeLatest(LOAD_PRICES, loadPricesSaga),
    takeLatest(REQUEST_PAYMENT, requestPaymentSaga),
    takeLatest(CHECK_PROMOCODE, checkPromocodeSaga)
  ])
}

sagasManager.addSagaToRoot(watcher)
