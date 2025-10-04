import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';

// 🔥 FIXED: No trailing spaces
const HASURA_ENDPOINT = 'https://fbjlcpshkpbwfdhhosrh.hasura.ap-south-1.nhost.run/v1/graphql';
const HASURA_ADMIN_SECRET = ":HK'qiL5cvojcHVzucs-K+tC5H-W@hrH";

const httpLink = new HttpLink({
  uri: HASURA_ENDPOINT,
});

// 🔥 ADD THIS: Authentication link for HTTP requests (mutations/queries)
const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
    }
  }
});

const wsLink = new WebSocketLink({
  uri: HASURA_ENDPOINT.replace('http', 'ws'),
  options: {
    reconnect: true,
    connectionParams: {
      headers: {
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
    },
  },
});

// 🔥 CHANGE THIS: Chain the auth link with http link
const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  authLink.concat(httpLink) // 🔥 This is the key change!
);

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

export default client;