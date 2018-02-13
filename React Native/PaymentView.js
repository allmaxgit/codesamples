import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Image,
  Keyboard,
  ActivityIndicator
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import Color from 'color'
import ResponseTimeSelection from './ResponseTimeSelection'
import PaymentOptionSelection from './PaymentOptionSelection'
import ToCModal from '../../../components/FullscreenModal'
import Loader from '../../../components/Loader'
import {
  clear,
  paymentOptions,
  requestPayment,
  setActiveSku,
  setPaymentOption,
  setPromocode,
  checkPromocode,
  getSelectedPrice
} from '../modules/Payment'
import { exitCase } from '../../NewCase/modules/NewCase'
import I18n from '../../../services/i18n'
import { submitCase } from '../../NewCase/modules/NewCase'
import { colors, metrics, fonts } from '../../../themes'
import styles from './styles/PaymentViewStyles'
import images from '../../../themes/images'

export class PaymentView extends Component {
  static propTypes = {
    setActiveSku: PropTypes.func.isRequired,
    setPaymentOption: PropTypes.func.isRequired,
    setPromocode: PropTypes.func.isRequired,
    checkPromocode: PropTypes.func.isRequired,
    clear: PropTypes.func.isRequired,
    submitCase: PropTypes.func.isRequired,
    requestPayment: PropTypes.func.isRequired,
    activeSku: PropTypes.string,
    promocode: PropTypes.string,
    paymentOption: PropTypes.string,
    withHUD: PropTypes.bool,
    processPayment: PropTypes.bool.isRequired,
    needCheckPromocode: PropTypes.bool.isRequired,
    isValidPromocode: PropTypes.bool.isRequired,
    validationPromocode: PropTypes.bool.isRequired,
    prices: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        sku: PropTypes.string.isRequired,
        prettyPrice: PropTypes.string.isRequired
      })
    ).isRequired
  }

  static defaultProps = {
    withHUD: false
  }

  static navigationOptions = ({ navigation: { dispatch } }) => {
    return {
      headerTintColor: '#FFFFFF',
      headerTitle: I18n.t('Payment.FillIn'),
      headerRight: (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => dispatch(exitCase(false))}
        >
          <Text style={styles.cancelButtonText}>
            {I18n.t('Payment.Cancel')}
          </Text>
        </TouchableOpacity>
      ),
      headerTitleStyle: {
        fontFamily: fonts.type.medium,
        fontSize: Platform.OS === 'ios' ? metrics.scale(16) : fonts.size.h5
      },
      headerStyle: {
        backgroundColor: colors.main
      }
    }
  }
  onPressSubmit = () => {
    const { activeSku, paymentOption, requestPayment } = this.props
    if (activeSku && paymentOption) {
      requestPayment()
    }
  }

  constructor (props) {
    super(props)
    this.state = {
      tocVisible: false
    }
  }

  componentWillMount () {
    const {
      clear,
      setPaymentOption,
      withHUD,
      prices,
      setActiveSku
    } = this.props
    clear()
    if (prices[0]) {
      setActiveSku(prices[0].sku)
    }
    if (withHUD) {
      setPaymentOption('promocode')
    }
  }

  renderAccessoryPromocode = () => {
    const {
      promocode,
      setPromocode,
      needCheckPromocode,
      isValidPromocode,
      validationPromocode
    } = this.props
    const visibleClear = !!promocode && !validationPromocode
    const visibleCheckStatus =
      !!promocode && !needCheckPromocode && !validationPromocode
    const statusIcon = isValidPromocode ? images.validIcon : images.invalidIcon
    return (
      <View style={styles.accessoryPromocodeContainer}>
        {visibleClear && (
          <TouchableOpacity
            key={'key_clearButton'}
            style={styles.clearButton}
            hitSlop={{ top: 10, right: 10, left: 10, bottom: 10 }}
            onPress={() => setPromocode('')}
          >
            <Image source={images.clearIcon} />
          </TouchableOpacity>
        )}
        {visibleCheckStatus && (
          <Image style={styles.statusIcon} source={statusIcon} />
        )}
        {validationPromocode && (
          <ActivityIndicator
            style={styles.activityIndicator}
            animating
            color={colors.main}
            size={'small'}
          />
        )}
      </View>
    )
  }

  render () {
    const {
      selectedPrice,
      activeSku,
      setActiveSku,
      prices,
      paymentOption,
      setPaymentOption,
      withHUD,
      promocode,
      setPromocode,
      isValidPromocode,
      checkPromocode,
      needCheckPromocode,
      validationPromocode
    } = this.props
    const submitButtonStyle = [styles.submitButton]
    let submitButtonDisabled = false
    if (!activeSku) {
      submitButtonStyle.push({
        backgroundColor:
          Platform.OS === 'ios' ? Color(colors.main).alpha(0.6) : '#A7B7C2'
      })
      submitButtonDisabled = true
    } else if (paymentOption === 'promocode' && !isValidPromocode) {
      submitButtonStyle.push({
        backgroundColor:
          Platform.OS === 'ios' ? Color(colors.main).alpha(0.6) : '#A7B7C2'
      })
      submitButtonDisabled = true
    }
    return (
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.headerText}>
          {I18n.t('Payment.ChooseSku').toUpperCase()}
        </Text>
        <ResponseTimeSelection
          key={'key_ResponseTimeSelection'}
          prices={prices}
          activeSelection={activeSku}
          onSelection={sku => setActiveSku(sku)}
        />
        <Text
          style={[
            styles.headerText,
            {
              marginTop: metrics.scale(36)
            }
          ]}
        >
          {I18n.t('Payment.ChooseOption').toUpperCase()}
        </Text>
        <PaymentOptionSelection
          key={'key_PaymentOptionSelection'}
          paymentOptions={paymentOptions.filter(p => {
            return !(
              (p.type === 'hsa' && this.props.country !== 'US') ||
              (p.type === 'promocode' && !withHUD)
            )
          })}
          activeSelection={paymentOption}
          onSelection={p => setPaymentOption(p)}
        />
        {paymentOption === 'promocode' && (
          <View>
            <View style={styles.textInputContainer}>
              <TextInput
                key={'key_promocodeTextInput'}
                style={styles.textInput}
                placeholder={I18n.t('Payment.EnterPromoCode')}
                placeholderTextColor={'#A7B7C2'}
                value={promocode}
                onChangeText={text => setPromocode(text)}
                onEndEditing={({ nativeEvent: { text } }) => {
                  if (text) {
                    checkPromocode()
                  }
                }}
                onSubmitEditing={() => Keyboard.dismiss()}
                autoCorrect={false}
              />
              {this.renderAccessoryPromocode()}
            </View>
            {!!promocode &&
              !needCheckPromocode &&
              !validationPromocode &&
              !isValidPromocode && (
                <Text style={styles.promocodeErrorText}>
                  {I18n.t('Payment.InvalidPromoCode')}
                </Text>
              )}
          </View>
        )}
        <View style={styles.tocContainer}>
          <Text style={styles.byPlacingText}>
            <Text>{I18n.t('Payment.ByPlacing')} </Text>
            <Text
              key={'key_tocText'}
              style={styles.tocText}
              onPress={() => this.setState({ tocVisible: true })}
            >
              {I18n.t('Payment.TermsAndConditions')}
            </Text>
          </Text>
        </View>
        {!withHUD && (
          <TouchableOpacity
            key={'key_infoButton'}
            hitSlop={{
              top: 30,
              right: 30,
              left: 30,
              bottom: 30
            }}
            onPress={() => {
              setPromocode('')
              if (paymentOption !== 'promocode') {
                setPaymentOption('promocode')
              } else {
                setPaymentOption('creditcard')
              }
            }}
          >
            <Image style={styles.infoIcon} source={images.infoIcon} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          key={'key_submitButton'}
          style={submitButtonStyle}
          activeOpacity={0.7}
          onPress={this.onPressSubmit}
          disabled={submitButtonDisabled}
        >
          <Text style={styles.submitButtonText}>
            {paymentOption === 'promocode'
              ? I18n.t('Payment.PromoSubmit').toUpperCase()
              : I18n.t('Payment.PayAndSubmit', {
                amountAndCurrency: selectedPrice && selectedPrice.prettyPrice
              }).toUpperCase()}
          </Text>
        </TouchableOpacity>
        <ToCModal
          key={'key_ToCModal'}
          visible={this.state.tocVisible}
          onClose={() => this.setState({ tocVisible: false })}
          heading={I18n.t('Payment.TermsAndConditions')}
          body={I18n.t('Messages.TermsAndConditions')}
        />
      </KeyboardAwareScrollView>
    )
  }
}

export default connect(
  state => ({
    prices: state.Payment.prices.prices,
    selectedPrice: getSelectedPrice(state),
    activeSku: state.Payment.activeSku,
    paymentOption: state.Payment.paymentOption,
    promocode: state.Payment.promocode,
    needCheckPromocode: state.Payment.needCheckPromocode,
    isValidPromocode: state.Payment.isValidPromocode,
    validationPromocode: state.Payment.validationPromocode,
    processPayment: state.Payment.processPayment,
    country: state.NewCase.theCase.country,
    withHUD: state.NewCase.theCase.withHUD
  }),
  dispatch =>
    bindActionCreators(
      {
        requestPayment,
        setActiveSku,
        setPaymentOption,
        clear,
        submitCase,
        setPromocode,
        checkPromocode
      },
      dispatch
    )
)(PaymentView)
