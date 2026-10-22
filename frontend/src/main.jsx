
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <CartProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </CartProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
);
