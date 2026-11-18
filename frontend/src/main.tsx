import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { store } from './app/store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Notifications } from './features/ui/Notifications';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
        <Notifications />
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
