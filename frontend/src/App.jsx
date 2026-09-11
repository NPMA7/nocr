'use client';
import { createContext, useContext } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { clearClientAuth } from '@/lib/roles';

export const API_URL = '/api';

// Create socket instance in client environment using same-origin HttpOnly cookie session
export const socket = typeof window !== 'undefined' 
  ? io('/', { 
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
    }) 
  : null;

// Connect only if authenticated and not on login page
if (typeof window !== 'undefined' && socket) {
  if (window.location.pathname !== '/login') {
    socket.connect();
  }

  socket.on('connect_error', (err) => {
    if (window.location.pathname !== '/login') {
      console.warn('Socket connection error:', err?.message || err);
    }
  });
}

// Configure Axios client-side (cookies are sent automatically with same-origin requests)
if (typeof window !== 'undefined') {
  axios.defaults.withCredentials = true;

  axios.interceptors.response.use(
    response => response,
    error => {
      if (error.response && error.response.status === 401) {
        if (window.location.pathname !== '/login') {
          clearClientAuth();
          if (socket) {
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
