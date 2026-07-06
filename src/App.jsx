'use client';
import { createContext, useContext } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export const API_URL = '/api';

// Create socket instance only in client environment
export const socket = typeof window !== 'undefined' 
  ? io('/', { path: '/socket.io' }) 
  : null;

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
          localStorage.removeItem('nocr_token');
          localStorage.removeItem('nocr_user');
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
