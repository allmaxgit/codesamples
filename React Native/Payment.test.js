import { Alert, Platform } from 'react-native'
import { NavigationActions } from 'react-navigation'
import { delay } from 'redux-saga'
import { all, call, put, select, takeLatest } from 'redux-saga/effects'
import accounting from 'accounting'
import getSymbolFromCurrency from 'currency-symbol-map'
import BTClient from 'react-native-braintree-xplat'
import { fetchCase } from '../../../Home/modules/Cases'
import { showLoader, dismissLoader } from '../../../../modules/App'
import { trackEvent } from '../../../../services/analytics'
import apiClient from '../../../../services/api'
import I18n from '../../../../services/i18n'
import sagaHelper from '../../../../services/sagaHelper'
import resolveCurrency from '../../../../services/resolveCurrency'
import config from '../../../../config'
import PaymentReducer, {
  CLEAR,
  SET_ACTIVE_SKU,
  SET_PAYMENT_OPTION,
  SET_PROMOCODE,
  LOAD_PRICES,
  LOAD_PRICES_BEGIN,
  LOAD_PRICES_SUCCESS,
  LOAD_PRICES_ERROR,
  REQUEST_PAYMENT,
  REQUEST_PAYMENT_BEGIN,
  REQUEST_PAYMENT_SUCCESS,
  REQUEST_PAYMENT_ERROR,
  CHECK_PROMOCODE,
  CHECK_PROMOCODE_BEGIN,
  CHECK_PROMOCODE_SUCCESS,
  CHECK_PROMOCODE_ERROR,
  extractPrice,
  paymentOptions,
  transformPrices,
  getAppConfig,
  getPromocode,
  getSelectedPrice,
  getTheCase,
  getPayment,
  clear,
  setActiveSku,
  setPaymentOption,
  setPromocode,
  loadPrices,
  requestPayment,
  checkPromocode,
  loadPricesSaga,
  checkPromocodeSaga,
  requestPaymentSaga,
  watcher
} from '../Payment'

jest.mock('react-native-braintree-xplat', () => ({
  setupWithURLScheme: jest.fn(),
  setup: jest.fn(),
  showPaymentViewController: jest.fn(),
  showPayPalViewController: jest.fn()
}))

jest.mock('../../../../services/api', () => ({
  prices: jest.fn(),
  checkPromocode: jest.fn(),
  applyPromocode: jest.fn(),
  paymentRequestCreate: jest.fn(),
  paymentCommit: jest.fn()
}))

jest.mock('../../../../services/sagasManager', () => ({
  addSagaToRoot: jest.fn()
}))

describe('actions', () => {
  it('should create an action to clear', () => {
    const expectedAction = {
      type: CLEAR
    }
    expect(clear()).toEqual(expectedAction)
  })

  it('should create an action to setActiveSku', () => {
    const expectedAction = {
      type: SET_ACTIVE_SKU,
      payload: 'derm8h'
    }
    expect(setActiveSku('derm8h')).toEqual(expectedAction)
  })

  it('should create an action to setPaymentOption', () => {
    const expectedAction = {
      type: SET_PAYMENT_OPTION,
      payload: 'paypal'
    }
    expect(setPaymentOption('paypal')).toEqual(expectedAction)
  })

  it('should create an action to setPromocode', () => {
    const expectedAction = {
      type: SET_PROMOCODE,
      payload: 'test'
    }
    expect(setPromocode('test')).toEqual(expectedAction)
  })

  it('should create an action to loadPrices', () => {
    const expectedAction = {
      type: LOAD_PRICES
    }
    expect(loadPrices()).toEqual(expectedAction)
  })

  it('should create an action to requestPayment', () => {
    const expectedAction = {
      type: REQUEST_PAYMENT
    }
    expect(requestPayment()).toEqual(expectedAction)
  })

  it('should create an action to checkPromocode', () => {
    const expectedAction = {
      type: CHECK_PROMOCODE
    }
    expect(checkPromocode()).toEqual(expectedAction)
  })
})

describe('Payment reducer', () => {
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
  it('should return the initial state', () => {
    expect(PaymentReducer(undefined, {})).toEqual(initialState)
  })

  it('should handle CLEAR', () => {
    expect(
      PaymentReducer(initialState, {
        type: CLEAR
      })
    ).toEqual({
      ...initialState
    })
  })

  it('should handle SET_ACTIVE_SKU', () => {
    expect(
      PaymentReducer(initialState, {
        type: SET_ACTIVE_SKU,
        payload: 'derm8h'
      })
    ).toEqual({
      ...initialState,
      activeSku: 'derm8h'
    })
  })

  it('should handle SET_PAYMENT_OPTION', () => {
    expect(
      PaymentReducer(initialState, {
        type: SET_PAYMENT_OPTION,
        payload: 'creditcard'
      })
    ).toEqual({
      ...initialState,
      paymentOption: 'creditcard'
    })
  })

  it('should handle SET_PROMOCODE', () => {
    expect(
      PaymentReducer(initialState, {
        type: SET_PROMOCODE,
        payload: 'test'
      })
    ).toEqual({
      ...initialState,
      needCheckPromocode: true,
      validationPromocode: false,
      isValidPromocode: false,
      promocode: 'test'
    })
  })

  it('should handle LOAD_PRICES_BEGIN', () => {
    expect(
      PaymentReducer(initialState, {
        type: LOAD_PRICES_BEGIN
      })
    ).toEqual({
      ...initialState,
      loadingPrices: true,
      pricesLoaded: false
    })
  })

  it('should handle LOAD_PRICES_SUCCESS', () => {
    const prices = require('./prices.json')
    expect(
      PaymentReducer(initialState, {
        type: LOAD_PRICES_SUCCESS,
        payload: { prices }
      })
    ).toEqual({
      ...initialState,
      loadingPrices: false,
      pricesLoaded: true,
      prices: prices
    })
  })

  it('should handle LOAD_PRICES_ERROR', () => {
    expect(
      PaymentReducer(initialState, {
        type: LOAD_PRICES_ERROR,
        payload: { error: {} }
      })
    ).toEqual({
      ...initialState,
      loadingPrices: false,
      error: {}
    })
  })

  it('should handle REQUEST_PAYMENT_BEGIN', () => {
    expect(
      PaymentReducer(initialState, {
        type: REQUEST_PAYMENT_BEGIN
      })
    ).toEqual({
      ...initialState,
      processPayment: true,
      paid: false
    })
  })

  it('should handle REQUEST_PAYMENT_SUCCESS', () => {
    expect(
      PaymentReducer(initialState, {
        type: REQUEST_PAYMENT_SUCCESS
      })
    ).toEqual({
      ...initialState,
      processPayment: false,
      paid: true
    })
  })

  it('should handle REQUEST_PAYMENT_ERROR', () => {
    expect(
      PaymentReducer(initialState, {
        type: REQUEST_PAYMENT_ERROR
      })
    ).toEqual({
      ...initialState,
      processPayment: false,
      paid: false
    })
  })

  it('should handle CHECK_PROMOCODE_BEGIN', () => {
    expect(
      PaymentReducer(initialState, {
        type: CHECK_PROMOCODE_BEGIN
      })
    ).toEqual({
      ...initialState,
      isValidPromocode: false,
      validationPromocode: true
    })
  })

  it('should handle CHECK_PROMOCODE_SUCCESS', () => {
    expect(
      PaymentReducer(initialState, {
        type: CHECK_PROMOCODE_SUCCESS
      })
    ).toEqual({
      ...initialState,
      activeSku: 'derm24h',
      needCheckPromocode: false,
      isValidPromocode: true,
      validationPromocode: false
    })
  })

  it('should handle CHECK_PROMOCODE_ERROR', () => {
    expect(
      PaymentReducer(initialState, {
        type: CHECK_PROMOCODE_ERROR
      })
    ).toEqual({
      ...initialState,
      needCheckPromocode: false,
      isValidPromocode: false,
      validationPromocode: false
    })
  })
})

describe('sagas', () => {
  describe('loadPricesSaga: Scenario 1', () => {
    const it = sagaHelper(loadPricesSaga())
    const prices = require('./prices.json')

    it('should trigger the LOAD_PRICES_BEGIN action', result => {
      expect(result).toEqual(put({ type: LOAD_PRICES_BEGIN }))
    })

    it('should get the app config from the state', result => {
      expect(result).toEqual(select(getAppConfig))
      return {
        culture: 'en-US',
        priceListId: 'ad9b5410-6126-4c3a-a02f-a36a3d36cfa2'
      }
    })

    it('should have called the resolveCurrency', result => {
      expect(result).toEqual(call(resolveCurrency, config.bundleId))
      return 'USD'
    })

    it('should have called the  apiClient.prices', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.prices],
          'ad9b5410-6126-4c3a-a02f-a36a3d36cfa2',
          'en-US',
          'USD'
        )
      )
      return prices
    })

    it('should trigger the LOAD_PRICES_SUCCESS action', result => {
      expect(result).toEqual(
        put({
          type: LOAD_PRICES_SUCCESS,
          payload: {
            prices: { ...prices, prices: transformPrices(prices.prices) }
          }
        })
      )
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('loadPricesSaga: Scenario 2', () => {
    const it = sagaHelper(loadPricesSaga())
    const error = new Error('loadPricesSaga error')
    it('should trigger the LOAD_PRICES_BEGIN action', result => {
      expect(result).toEqual(put({ type: LOAD_PRICES_BEGIN }))
    })

    it('should get the app config from the state', result => {
      expect(result).toEqual(select(getAppConfig))
      return {
        culture: 'en-US',
        priceListId: 'ad9b5410-6126-4c3a-a02f-a36a3d36cfa2'
      }
    })

    it('should have called the resolveCurrency', result => {
      expect(result).toEqual(call(resolveCurrency, config.bundleId))
      return new Error()
    })

    it('should have called the  apiClient.prices', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.prices],
          'ad9b5410-6126-4c3a-a02f-a36a3d36cfa2',
          'en-US',
          null
        )
      )
      return error
    })

    it('should trigger the LOAD_PRICES_ERROR action', result => {
      expect(result).toEqual(
        put({
          type: LOAD_PRICES_ERROR,
          payload: {
            error
          }
        })
      )
    })

    it('should have called the Alert.alert', result => {
      expect(result).toEqual(
        call(Alert.alert, 'Error', I18n.t('ErrorMessages.LoadPriceList'))
      )
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('checkPromocodeSaga: Scenario 1', () => {
    const it = sagaHelper(checkPromocodeSaga())

    it('should trigger the CHECK_PROMOCODE_BEGIN action', result => {
      expect(result).toEqual(put({ type: CHECK_PROMOCODE_BEGIN }))
    })

    it('should get the promocode from the state', result => {
      expect(result).toEqual(select(getPromocode))
      return 'test'
    })

    it('should have called the  apiClient.prices', result => {
      expect(result).toEqual(
        call([apiClient, apiClient.checkPromocode], 'test')
      )
      return true
    })

    it('should trigger the CHECK_PROMOCODE_SUCCESS action', result => {
      expect(result).toEqual(
        put({
          type: CHECK_PROMOCODE_SUCCESS
        })
      )
    })
    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('checkPromocodeSaga: Scenario 2', () => {
    const it = sagaHelper(checkPromocodeSaga())

    it('should trigger the CHECK_PROMOCODE_BEGIN action', result => {
      expect(result).toEqual(put({ type: CHECK_PROMOCODE_BEGIN }))
    })

    it('should get the promocode from the state', result => {
      expect(result).toEqual(select(getPromocode))
      return 'test'
    })

    it('should have called the  apiClient.prices', result => {
      expect(result).toEqual(
        call([apiClient, apiClient.checkPromocode], 'test')
      )
      return false
    })

    it('should trigger the CHECK_PROMOCODE_ERROR action', result => {
      expect(result).toEqual(
        put({
          type: CHECK_PROMOCODE_ERROR
        })
      )
    })
    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('checkPromocodeSaga: Scenario 3', () => {
    const it = sagaHelper(checkPromocodeSaga())

    it('should trigger the CHECK_PROMOCODE_BEGIN action', result => {
      expect(result).toEqual(put({ type: CHECK_PROMOCODE_BEGIN }))
    })

    it('should get the promocode from the state', result => {
      expect(result).toEqual(select(getPromocode))
      return 'test'
    })

    it('should have called the  apiClient.checkPromocode', result => {
      expect(result).toEqual(
        call([apiClient, apiClient.checkPromocode], 'test')
      )
      return new Error()
    })

    it('should trigger the CHECK_PROMOCODE_ERROR action', result => {
      expect(result).toEqual(
        put({
          type: CHECK_PROMOCODE_ERROR
        })
      )
    })
    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('requestPaymentSaga: Scenario 1', () => {
    const it = sagaHelper(requestPaymentSaga())

    it('should trigger the REQUEST_PAYMENT_BEGIN action', result => {
      expect(result).toEqual(put({ type: REQUEST_PAYMENT_BEGIN }))
    })

    it('should trigger the showLoader action', result => {
      expect(result).toEqual(put(showLoader(I18n.t('Message.CreatingPayment'))))
    })

    it('should get the selected price from the state', result => {
      expect(result).toEqual(select(getSelectedPrice))
      return {
        id: '54781200-66ff-4e64-ab90-cd0fe239d49c',
        name: '8 hours',
        description: 'You get a response to your question within 8 hours.',
        sku: 'derm8h',
        amount: 59.95,
        currency: 'USD',
        responseHours: 8,
        prettyPrice: '$59.95'
      }
    })

    it('should get the selected case from the state', result => {
      expect(result).toEqual(select(getTheCase))
      return {
        id: '77682886-48ea-41f3-af8f-8d4f97003c90',
        caseCode: 'BIIOWTKM'
      }
    })

    it('should get the selected Payment from the state', result => {
      expect(result).toEqual(select(getPayment))
      return {
        paymentOption: 'promocode',
        promocode: 'test',
        needCheckPromocode: false,
        isValidPromocode: true
      }
    })

    it('should have called the apiClient.applyPromocode', result => {
      expect(result).toEqual(
        call([apiClient, apiClient.applyPromocode], 'BIIOWTKM', 'test')
      )
      return {
        FullyPaid: true,
        LeftToPay: {
          Amount: 0,
          Currency: {
            IsoCode: 'USD'
          }
        }
      }
    })

    it('should trigger the REQUEST_PAYMENT_SUCCESS action', result => {
      expect(result).toEqual(
        put({
          type: REQUEST_PAYMENT_SUCCESS,
          payload: {
            FullyPaid: true,
            LeftToPay: {
              Amount: 0,
              Currency: {
                IsoCode: 'USD'
              }
            }
          }
        })
      )
    })

    it('should trigger the fetchCase action', result => {
      expect(result).toEqual(put(fetchCase('BIIOWTKM')))
    })

    it('should trigger the NavigationActions.navigate action', result => {
      expect(result).toEqual(
        put(
          NavigationActions.navigate({
            routeName: 'PaymentSuccess',
            params: { caseCode: 'BIIOWTKM', responseHours: 8 }
          })
        )
      )
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(put(dismissLoader()))
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('requestPaymentSaga: Scenario 2', () => {
    const it = sagaHelper(requestPaymentSaga())

    it('should trigger the REQUEST_PAYMENT_BEGIN action', result => {
      expect(result).toEqual(put({ type: REQUEST_PAYMENT_BEGIN }))
    })

    it('should trigger the showLoader action', result => {
      expect(result).toEqual(put(showLoader(I18n.t('Message.CreatingPayment'))))
    })

    it('should get the selected price from the state', result => {
      expect(result).toEqual(select(getSelectedPrice))
      return {
        id: '54781200-66ff-4e64-ab90-cd0fe239d49c',
        name: '8 hours',
        description: 'You get a response to your question within 8 hours.',
        sku: 'derm8h',
        amount: 59.95,
        currency: 'USD',
        responseHours: 8,
        prettyPrice: '$59.95'
      }
    })

    it('should get the selected case from the state', result => {
      expect(result).toEqual(select(getTheCase))
      return {
        id: '77682886-48ea-41f3-af8f-8d4f97003c90',
        caseCode: 'BIIOWTKM'
      }
    })

    it('should get the selected Payment from the state', result => {
      expect(result).toEqual(select(getPayment))
      return {
        paymentOption: 'promocode',
        promocode: 'test',
        needCheckPromocode: false,
        isValidPromocode: true
      }
    })

    it('should have called the apiClient.applyPromocode', result => {
      expect(result).toEqual(
        call([apiClient, apiClient.applyPromocode], 'BIIOWTKM', 'test')
      )
      return {
        FullyPaid: false,
        LeftToPay: {
          Amount: 0,
          Currency: {
            IsoCode: 'USD'
          }
        }
      }
    })

    it('should have called the apiClient.paymentRequestCreate', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentRequestCreate],
          '77682886-48ea-41f3-af8f-8d4f97003c90',
          '54781200-66ff-4e64-ab90-cd0fe239d49c'
        )
      )
      return {
        amount: 39.95,
        currency: 'USD',
        paymentRequestId: 'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
        token: 'token'
      }
    })

    it('should have called the BTClient.setupWithURLScheme', result => {
      expect(result).toEqual(
        call(
          [BTClient, BTClient.setupWithURLScheme],
          'token',
          `${config.bundleId}.payments`
        )
      )
    })

    it('should have called the BTClient.showPaymentViewController', result => {
      expect(result).toEqual(
        call([BTClient, BTClient.showPaymentViewController], {})
      )
      return 'paymentNonce'
    })

    it('should have called the apiClient.paymentCommit', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentCommit],
          'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
          'paymentNonce'
        )
      )
      return true
    })

    it('should trigger the REQUEST_PAYMENT_SUCCESS action', result => {
      expect(result).toEqual(
        put({
          type: REQUEST_PAYMENT_SUCCESS,
          payload: true
        })
      )
    })

    it('should trigger the fetchCase action', result => {
      expect(result).toEqual(put(fetchCase('BIIOWTKM')))
    })

    it('should trigger the NavigationActions.navigate action', result => {
      expect(result).toEqual(
        put(
          NavigationActions.navigate({
            routeName: 'PaymentSuccess',
            params: { caseCode: 'BIIOWTKM', responseHours: 8 }
          })
        )
      )
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(put(dismissLoader()))
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('requestPaymentSaga: Scenario 3', () => {
    const it = sagaHelper(requestPaymentSaga())

    it('should trigger the REQUEST_PAYMENT_BEGIN action', result => {
      expect(result).toEqual(put({ type: REQUEST_PAYMENT_BEGIN }))
    })

    it('should trigger the showLoader action', result => {
      expect(result).toEqual(put(showLoader(I18n.t('Message.CreatingPayment'))))
    })

    it('should get the selected price from the state', result => {
      expect(result).toEqual(select(getSelectedPrice))
      return {
        id: '54781200-66ff-4e64-ab90-cd0fe239d49c',
        name: '8 hours',
        description: 'You get a response to your question within 8 hours.',
        sku: 'derm8h',
        amount: 59.95,
        currency: 'USD',
        responseHours: 8,
        prettyPrice: '$59.95'
      }
    })

    it('should get the selected case from the state', result => {
      expect(result).toEqual(select(getTheCase))
      return {
        id: '77682886-48ea-41f3-af8f-8d4f97003c90',
        caseCode: 'BIIOWTKM'
      }
    })

    it('should get the selected Payment from the state', result => {
      expect(result).toEqual(select(getPayment))
      return {
        paymentOption: 'promocode',
        promocode: 'test',
        needCheckPromocode: false,
        isValidPromocode: true
      }
    })

    it('should have called the apiClient.applyPromocode', result => {
      expect(result).toEqual(
        call([apiClient, apiClient.applyPromocode], 'BIIOWTKM', 'test')
      )
      return {
        FullyPaid: false,
        LeftToPay: {
          Amount: 0,
          Currency: {
            IsoCode: 'USD'
          }
        }
      }
    })

    it('should have called the apiClient.paymentRequestCreate', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentRequestCreate],
          '77682886-48ea-41f3-af8f-8d4f97003c90',
          '54781200-66ff-4e64-ab90-cd0fe239d49c'
        )
      )
      return {
        amount: 39.95,
        currency: 'USD',
        paymentRequestId: 'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
        token: 'token'
      }
    })

    it('should have called the BTClient.setupWithURLScheme', result => {
      expect(result).toEqual(
        call(
          [BTClient, BTClient.setupWithURLScheme],
          'token',
          `${config.bundleId}.payments`
        )
      )
    })

    it('should have called the BTClient.showPaymentViewController', result => {
      expect(result).toEqual(
        call([BTClient, BTClient.showPaymentViewController], {})
      )
      return 'paymentNonce'
    })

    it('should have called the apiClient.paymentCommit', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentCommit],
          'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
          'paymentNonce'
        )
      )
      return false
    })

    it('should have called the Alert.alert', result => {
      expect(result).toEqual(
        call(
          [Alert, Alert.alert],
          'Error',
          I18n.t('ErrorMessages.CommitPayment')
        )
      )
    })

    it('should trigger the REQUEST_PAYMENT_ERROR action', result => {
      expect(result).toEqual(
        put({
          type: REQUEST_PAYMENT_ERROR
        })
      )
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(put(dismissLoader()))
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('requestPaymentSaga: Scenario 4', () => {
    const it = sagaHelper(requestPaymentSaga())

    it('should trigger the REQUEST_PAYMENT_BEGIN action', result => {
      expect(result).toEqual(put({ type: REQUEST_PAYMENT_BEGIN }))
    })

    it('should trigger the showLoader action', result => {
      expect(result).toEqual(put(showLoader(I18n.t('Message.CreatingPayment'))))
    })

    it('should get the selected price from the state', result => {
      expect(result).toEqual(select(getSelectedPrice))
      return {
        id: '54781200-66ff-4e64-ab90-cd0fe239d49c',
        name: '8 hours',
        description: 'You get a response to your question within 8 hours.',
        sku: 'derm8h',
        amount: 59.95,
        currency: 'USD',
        responseHours: 8,
        prettyPrice: '$59.95'
      }
    })

    it('should get the selected case from the state', result => {
      expect(result).toEqual(select(getTheCase))
      return {
        id: '77682886-48ea-41f3-af8f-8d4f97003c90',
        caseCode: 'BIIOWTKM'
      }
    })

    it('should get the selected Payment from the state', result => {
      expect(result).toEqual(select(getPayment))
      return {
        paymentOption: 'creditcard',
        promocode: null,
        needCheckPromocode: false,
        isValidPromocode: false
      }
    })

    it('should have called the apiClient.paymentRequestCreate', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentRequestCreate],
          '77682886-48ea-41f3-af8f-8d4f97003c90',
          '54781200-66ff-4e64-ab90-cd0fe239d49c'
        )
      )
      return {
        amount: 39.95,
        currency: 'USD',
        paymentRequestId: 'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
        token: 'token'
      }
    })

    it('should have called the BTClient.setupWithURLScheme', result => {
      expect(result).toEqual(
        call(
          [BTClient, BTClient.setupWithURLScheme],
          'token',
          `${config.bundleId}.payments`
        )
      )
    })

    it('should have delay', result => {
      // expect(result).toEqual(delay(3000))
    })

    it('should have called the BTClient.showPaymentViewController', result => {
      expect(result).toEqual(
        call([BTClient, BTClient.showPaymentViewController], {})
      )
      return 'paymentNonce'
    })

    it('should have called the apiClient.paymentCommit', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentCommit],
          'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
          'paymentNonce'
        )
      )
      return true
    })

    it('should trigger the REQUEST_PAYMENT_SUCCESS action', result => {
      expect(result).toEqual(
        put({
          type: REQUEST_PAYMENT_SUCCESS,
          payload: true
        })
      )
    })

    it('should trigger the fetchCase action', result => {
      expect(result).toEqual(put(fetchCase('BIIOWTKM')))
    })

    it('should trigger the NavigationActions.navigate action', result => {
      expect(result).toEqual(
        put(
          NavigationActions.navigate({
            routeName: 'PaymentSuccess',
            params: { caseCode: 'BIIOWTKM', responseHours: 8 }
          })
        )
      )
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(put(dismissLoader()))
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('requestPaymentSaga: Scenario 5', () => {
    const it = sagaHelper(requestPaymentSaga())

    it('should trigger the REQUEST_PAYMENT_BEGIN action', result => {
      expect(result).toEqual(put({ type: REQUEST_PAYMENT_BEGIN }))
    })

    it('should trigger the showLoader action', result => {
      expect(result).toEqual(put(showLoader(I18n.t('Message.CreatingPayment'))))
    })

    it('should get the selected price from the state', result => {
      expect(result).toEqual(select(getSelectedPrice))
      return {
        id: '54781200-66ff-4e64-ab90-cd0fe239d49c',
        name: '8 hours',
        description: 'You get a response to your question within 8 hours.',
        sku: 'derm8h',
        amount: 59.95,
        currency: 'USD',
        responseHours: 8,
        prettyPrice: '$59.95'
      }
    })

    it('should get the selected case from the state', result => {
      expect(result).toEqual(select(getTheCase))
      return {
        id: '77682886-48ea-41f3-af8f-8d4f97003c90',
        caseCode: 'BIIOWTKM'
      }
    })

    it('should get the selected Payment from the state', result => {
      expect(result).toEqual(select(getPayment))
      return {
        paymentOption: 'paypal',
        promocode: null,
        needCheckPromocode: false,
        isValidPromocode: false
      }
    })

    it('should have called the apiClient.paymentRequestCreate', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentRequestCreate],
          '77682886-48ea-41f3-af8f-8d4f97003c90',
          '54781200-66ff-4e64-ab90-cd0fe239d49c'
        )
      )
      return {
        amount: 39.95,
        currency: 'USD',
        paymentRequestId: 'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
        token: 'token'
      }
    })

    it('should have called the BTClient.setupWithURLScheme', result => {
      expect(result).toEqual(
        call(
          [BTClient, BTClient.setupWithURLScheme],
          'token',
          `${config.bundleId}.payments`
        )
      )
    })

    it('should have delay', result => {
      // expect(result).toEqual(delay(3000))
    })

    it('should have called the BTClient.showPaymentViewController', result => {
      expect(result).toEqual(
        call([BTClient, BTClient.showPayPalViewController], {})
      )
      return 'paymentNonce'
    })

    it('should have called the apiClient.paymentCommit', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentCommit],
          'f54f41d0-7b3f-42cb-b3b5-f9f55224be44',
          'paymentNonce'
        )
      )
      return false
    })

    it('should have called the Alert.alert', result => {
      expect(result).toEqual(
        call(
          [Alert, Alert.alert],
          'Error',
          I18n.t('ErrorMessages.CommitPayment')
        )
      )
    })

    it('should trigger the REQUEST_PAYMENT_ERROR action', result => {
      expect(result).toEqual(
        put({
          type: REQUEST_PAYMENT_ERROR
        })
      )
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(put(dismissLoader()))
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('requestPaymentSaga: Scenario 6', () => {
    const it = sagaHelper(requestPaymentSaga())
    const error = new Error('requestPaymentSaga')
    it('should trigger the REQUEST_PAYMENT_BEGIN action', result => {
      expect(result).toEqual(put({ type: REQUEST_PAYMENT_BEGIN }))
    })

    it('should trigger the showLoader action', result => {
      expect(result).toEqual(put(showLoader(I18n.t('Message.CreatingPayment'))))
    })

    it('should get the selected price from the state', result => {
      expect(result).toEqual(select(getSelectedPrice))
      return {
        id: '54781200-66ff-4e64-ab90-cd0fe239d49c',
        name: '8 hours',
        description: 'You get a response to your question within 8 hours.',
        sku: 'derm8h',
        amount: 59.95,
        currency: 'USD',
        responseHours: 8,
        prettyPrice: '$59.95'
      }
    })

    it('should get the selected case from the state', result => {
      expect(result).toEqual(select(getTheCase))
      return {
        id: '77682886-48ea-41f3-af8f-8d4f97003c90',
        caseCode: 'BIIOWTKM'
      }
    })

    it('should get the selected Payment from the state', result => {
      expect(result).toEqual(select(getPayment))
      return {
        paymentOption: 'creditcard',
        promocode: null,
        needCheckPromocode: false,
        isValidPromocode: false
      }
    })

    it('should have called the apiClient.paymentRequestCreate', result => {
      expect(result).toEqual(
        call(
          [apiClient, apiClient.paymentRequestCreate],
          '77682886-48ea-41f3-af8f-8d4f97003c90',
          '54781200-66ff-4e64-ab90-cd0fe239d49c'
        )
      )
      return error
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(put(dismissLoader()))
    })

    it('should trigger the dismissLoader action', result => {
      expect(result).toEqual(
        put({ type: REQUEST_PAYMENT_ERROR, payload: { error } })
      )
    })

    it('should have called the Alert.alert', result => {
      expect(result).toEqual(
        call(
          [Alert, Alert.alert],
          'Error',
          I18n.t('ErrorMessages.CreatePayment')
        )
      )
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })

  describe('watcher', () => {
    const it = sagaHelper(watcher())
    it('should trigger watcher', result => {
      expect(result).toEqual(
        all([
          takeLatest(LOAD_PRICES, loadPricesSaga),
          takeLatest(REQUEST_PAYMENT, requestPaymentSaga),
          takeLatest(CHECK_PROMOCODE, checkPromocodeSaga)
        ])
      )
    })

    it('and then nothing', result => {
      expect(result).toBeUndefined()
    })
  })
})
