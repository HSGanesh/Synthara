import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Auth token injection
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const askQuestion = async (question, collectionName = "synthara_default") => {
  const res = await API.post('/api/query/ask', {
    question,
    collection_name: collectionName
  })
  return res.data
}

export const uploadFile = async (file, collectionName = "synthara_default") => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await API.post(`/api/ingest/upload?collection_name=${collectionName}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res.data
}

export const getCollections = async () => {
  const res = await API.get('/api/ingest/collections')
  return res.data
}

export const getLastCollection = async () => {
  const res = await API.get('/api/ingest/last-collection')
  return res.data
}

export const clearKnowledgeBase = async (collectionName = "synthara_default") => {
  const res = await API.delete(`/api/ingest/clear?collection_name=${collectionName}`)
  return res.data
}

export const login = async (username, password) => {
  const res = await API.post('/api/auth/login', { username, password })
  return res.data
}

export const register = async (username, password) => {
  const res = await API.post('/api/auth/register', { username, password })
  return res.data
}

export const healthCheck = async () => {
  const res = await API.get('/api/health')
  return res.data
}