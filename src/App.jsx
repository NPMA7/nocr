'use client';
import { createContext, useContext } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { clearClientAuth } from '@/lib/roles';

export const API_URL = '/api';

// Create socket instance only in client environment with dynamic auth token
export const socket = typeof window !== 'undefined' 
  ? io('/', { 
      path: '/socket.io',
      autoConnect: false,
      auth: (cb) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('nocr_token') : null;
        cb({ token });
      }
    }) 
  : null;

// Connect only if authenticated and not on login page
if (typeof window !== 'undefined' && socket) {
  const token = localStorage.getItem('nocr_token');
  if (token && window.location.pathname !== '/login') {
    socket.auth = { token };
    socket.connect();
  }

  socket.on('connect_error', (err) => {
    if (window.location.pathname !== '/login') {
      console.warn('Socket connection error:', err?.message || err);
    }
  });
}

// Configure Axios Interceptors client-side
if (typeof window !== 'undefined') {
  axios.interceptors.request.use(config => {
    const token = localStorage.getItem('nocr_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    response => response,
    error => {
      if (error.response && (error.response.status === 401)) {
        if (window.location.pathname !== '/login') {
          clearClientAuth();
          if (socket) {
            socket.auth = { token: null };
            socket.disconnect();
          }
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
}

export const AppStateContext = createContext(null);

export function useAppState() {
  const context = useContext(AppStateContext);
  return context || {};
}
