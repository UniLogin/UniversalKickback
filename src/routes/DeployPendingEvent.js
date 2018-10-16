import React, { Component } from 'react'
import { Link } from 'react-router-dom'
import styled from 'react-emotion'

import ChainMutation, { ChainMutationButton } from '../components/ChainMutation'
import { CreateParty } from '../graphql/mutations'
import { GlobalConsumer } from '../GlobalState'
import { extractNewPartyAddressFromTx } from '../api/utils'
import queryString from 'query-string'

const SeedDiv = styled('div')`
  margin-bottom: 2em;
  background-color: #efefef;
  padding: 1em;
`

class DeployPendingEvent extends Component {
  render() {
    const { id, deposit, limitOfParticipants } = queryString.parse(
      this.props.location.search
    )

    return (
      <div className="App">
        <h1>Deploy pending party</h1>
        <SeedDiv>
          <p>If you wish to deploy this party with our seeding script, use:</p>
          <GlobalConsumer>
            {({ networkState: { isLocalNetwork, networkName } }) => (
              <pre>yarn seed:party -i {id} {isLocalNetwork ? '' : `--${networkName.toLowerCase()}`}</pre>
            )}
          </GlobalConsumer>
        </SeedDiv>
        <div>
          <div>id/name: {id}</div>
          <div>deposit: {deposit}</div>
          <div>limitOfParticipants: {limitOfParticipants}</div>
          <ChainMutation
            mutation={CreateParty}
            resultKey="create"
            variables={{ id, deposit, limitOfParticipants }}
          >
            {(createParty, result) => {
              const address = result.data
                ? extractNewPartyAddressFromTx(result.data)
                : null

              return (
                <div>
                  <ChainMutationButton
                    result={result}
                    onClick={createParty}
                    preContent="Deploy!"
                    postContent="Deployed!"
                  />
                  {address ? (
                    <p>
                      Party at {address}!{' '}
                      <Link to={`/event/${address}`}>View party page</Link>
                    </p>
                  ) : null}
                </div>
              )
            }}
          </ChainMutation>
        </div>
      </div>
    )
  }
}

export default DeployPendingEvent
