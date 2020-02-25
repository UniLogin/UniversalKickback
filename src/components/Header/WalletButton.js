import React from 'react'
import styled from '@emotion/styled'
import mq from '../../mediaQuery'

import { GlobalConsumer } from '../../GlobalState'
import Button from '../Forms/Button'

const CTAButton = styled(Button)`
  font-weight: bold;
  width: 100%;
  ${mq.small`
    width: auto;
  `};
`

function WalletButton() {
  return (
    <GlobalConsumer>
      {({ wallet, signIn }) => {
        if (!wallet) {
          return (
            <CTAButton type="light" onClick={signIn} analyticsId="Sign In">
              Connect Kickback to Wallet
            </CTAButton>
          )
        }
      }}
    </GlobalConsumer>
  )
}

export default WalletButton
