import axios from 'axios';

let topologyCache = null;
let topologyFetchPromise = null;
let topologyLastFetch = 0;

export const fetchTopologyCached = async (force = false) => {
  const API_URL = '/api';
  
  if (force) {
    topologyFetchPromise = axios.get(`${API_URL}/topology`).finally(() => {
        topologyFetchPromise = null;
    });
    const res = await topologyFetchPromise;
    topologyCache = res.data;
    topologyLastFetch = Date.now();
    return topologyCache;
  }
  
  if (topologyCache && Date.now() - topologyLastFetch < 30000) {
    return topologyCache;
  }
  
  if (topologyFetchPromise) {
    const res = await topologyFetchPromise;
    return res.data; // Note: we return res.data directly if another promise is active
  }
  
  topologyFetchPromise = axios.get(`${API_URL}/topology`).finally(() => {
    topologyFetchPromise = null;
  });
  
  const res = await topologyFetchPromise;
  topologyCache = res.data;
  topologyLastFetch = Date.now();
  return topologyCache;
};

export const updateTopologyCacheLocally = (newData) => {
    topologyCache = newData;
    topologyLastFetch = Date.now();
};
