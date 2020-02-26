import _ from 'lodash'
import React, { createContext, Component } from 'react'
import { withApollo } from 'react-apollo'
import jwt from 'jsonwebtoken'
import Web3 from 'web3'

import { identify as logRocketIdentify } from './api/logRocket'
import * as LocalStorage from './api/localStorage'
import { getAccount, updateNetwork, pollForBlocks } from './api/web3'
import { SIGN_IN } from './modals'
import { LOGIN_USER_NO_AUTH } from './graphql/mutations'
import { buildAuthHeaders } from './utils/requests'
import ULIFrameProvider from '@unilogin/provider'

const GlobalContext = createContext({})

export default GlobalContext

export const GlobalConsumer = GlobalContext.Consumer

let setProviderInstance
const providerPromise = new Promise(resolve => {
  setProviderInstance = resolve
})

let setSignedIn
const signInPromise = new Promise(resolve => {
  setSignedIn = resolve
})

export const getProvider = () => providerPromise

const AUTH = 'auth'
const WALLET = 'wallet'
const TOKEN_SECRET = 'kickback'
const TOKEN_ALGORITHM = 'HS256'

class Provider extends Component {
  state = {
    apolloClient: this.props.client,
    currentModal: null,
    auth: LocalStorage.getItem(AUTH) || {},
    networkState: {},
    web3: null
  }

  authToken() {
    return this.state.auth.token
  }

  apolloClient() {
    return this.state.apolloClient
  }

  isLoggedIn() {
    return this.state.auth.loggedIn
  }

  setUpWallet = async ({ action, networkId, dontForceSetUp }) => {
    // Check if user has chosen a wallet before, if so just use that.
    // If not, the user will have to select a wallet so only proceed if required.
    const lastUsedWallet = LocalStorage.getItem(WALLET)
    if (!lastUsedWallet && dontForceSetUp) {
      return null
    }

    const provider = ULIFrameProvider.createPicker(
      window.ethereum || networkId.toString()
    )
    const web3 = new Web3(provider)
    await new Promise(resolve =>
      provider.send(
        {
          method: 'eth_requestAccounts'
        },
        resolve
      )
    )
    this.setState({ wallet: { name: 'UniLogin' }, web3 })
    return web3
  }

  signIn = async ({ dontForceSignIn } = {}) => {
    if (this.state.loggedIn) {
      return
    }

    if (!dontForceSignIn && !this.state.wallet) {
      const { expectedNetworkId } = this.state.networkState
      await this.setUpWallet({
        action: 'Sign in',
        networkId: expectedNetworkId
      })
    }

    // let's request user's account address
    const address = await this.reloadUserAddress()
    if (!address) {
      return
    }

    console.debug(`Checking if user ${address} is logged in ...`)

    try {
      const token = this.authToken()
      const payload = jwt.verify(token, TOKEN_SECRET, {
        algorithm: TOKEN_ALGORITHM
      })
      if (_.get(payload, 'address', '') !== address) {
        throw new Error('Token not valid for current user address')
      }

      const {
        data: { profile }
      } = await this.apolloClient().mutate({
        mutation: LOGIN_USER_NO_AUTH,
        context: {
          headers: buildAuthHeaders(token)
        }
      })

      console.debug(`User ${address} is logged in and has a profile`)

      this.setUserProfile(profile)
    } catch (err) {
      console.debug(
        `User ${address} is not logged and/or does not have a profile`
      )

      this.setState(state => ({
        auth: {
          ...state.auth,
          token: undefined,
          profile: null,
          loggedIn: false
        }
      }))

      if (!dontForceSignIn) {
        this.showModal({ name: SIGN_IN })

        return signInPromise
      }
    }
  }

  signOut = async () => {
    try {
      this.state.onboard.walletReset()
    } catch (error) {
      console.log(error)
    }

    this.setState(state => ({
      auth: {
        ...state.auth,
        address: undefined,
        token: undefined,
        profile: null,
        loggedIn: false
      },
      wallet: undefined,
      web3: null,
      resetWallet: null
    }))

    // Wipe saved wallet
    LocalStorage.removeItem(WALLET)
  }

  setUserProfile = profile => {
    console.log('Current user', profile)

    logRocketIdentify(profile)

    this.setState(
      state => ({
        auth: {
          ...state.auth,
          profile,
          // need this on both this function and setUserProfile() since they can be called independently of each other
          loggedIn: true
        }
      }),
      /* now we resolve the promsie -> */ setSignedIn
    )
  }

  setAuthTokenFromSignature = (address, sig) => {
    const token = jwt.sign({ address, sig }, TOKEN_SECRET, {
      algorithm: TOKEN_ALGORITHM
    })

    console.log(`New auth token: ${token}`)

    // save to local storage for next time!
    LocalStorage.setItem(AUTH, { token })

    this.setState(state => ({
      auth: {
        ...state.auth,
        token,
        // need this on both this function and setUserProfile() since they can be called independently of each other
        loggedIn: true
      }
    }))
  }

  showModal = modal => {
    this.setState({
      currentModal: modal
    })
  }

  closeModal = modal => {
    this.setState(state => {
      if (state.currentModal && state.currentModal.name === modal.name) {
        return {
          currentModal: null
        }
      } else {
        return state
      }
    })
  }

  async componentDidMount() {
    setProviderInstance(this)

    // Get which network app is on
    const networkState = await updateNetwork()

    // Try and open wallet
    await this.setUpWallet({
      action: 'Sign In',
      networkId: networkState.expectedNetworkId,
      dontForceSetUp: true
    })

    // try and sign in!
    await this.signIn({ dontForceSignIn: true })
  }

  setNetworkState = networkState => {
    this.setState({ networkState })
  }

  reloadUserAddress = async () => {
    const address = await getAccount()

    if (address) {
      await new Promise(resolve => {
        this.setState(
          state => ({
            auth: {
              ...state.auth,
              address
            }
          }),
          resolve
        )
      })
    }

    return address
  }

  render() {
    return (
      <GlobalContext.Provider
        value={{
          apolloClient: this.apolloClient(),
          currentModal: this.state.currentModal,
          userAddress: this.state.auth.address,
          reloadUserAddress: this.reloadUserAddress,
          userProfile: this.state.auth.profile,
          networkState: this.state.networkState,
          loggedIn: this.isLoggedIn(),
          signIn: this.signIn,
          signOut: this.signOut,
          signInError: this.state.signInError,
          showModal: this.showModal,
          closeModal: this.closeModal,
          setAuthTokenFromSignature: this.setAuthTokenFromSignature,
          setUserProfile: this.setUserProfile,
          web3: this.state.web3,
          wallet: this.state.wallet
        }}
      >
        {this.props.children}
      </GlobalContext.Provider>
    )
  }
}

export const GlobalProvider = withApollo(Provider)
