import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ApolloProvider } from '@apollo/client';
import client from './apolloClient';


const root = ReactDOM.createRoot(document.getElementById('root'));
// Add this at the top of index.js, after imports
if (process.env.NODE_ENV !== 'production') {
  const { loadDevMessages, loadErrorMessages } = require('@apollo/client/dev');
  loadDevMessages();
  loadErrorMessages();
}
root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);


reportWebVitals();