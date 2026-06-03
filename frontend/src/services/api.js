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

// Auto logout on token expiry
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('synthara_chat')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
export const askQuestion = async (question, collectionName, history, sessionId) => {
  const token = localStorage.getItem('token')
  const res = await API.post('/api/query/ask', {
    question,
    collection_name: collectionName,
    token: token || null,
    history: history || [],
    session_id: sessionId || null,
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

export const getMyCollections = async () => {
  const token = localStorage.getItem('token')
  if (!token) return { collections: [] }
  const res = await API.get(`/api/ingest/my-collections?token=${token}`)
  return res.data
}

export const getLastCollection = async () => {
  return { collection: 'synthara_default' }
}

export const clearKnowledgeBase = async (collectionName = "synthara_default") => {
  const res = await API.delete(`/api/ingest/clear?collection_name=${collectionName}`)
  return res.data
}

export const getChatHistory = async () => {
  const token = localStorage.getItem('token')
  if (!token) return { history: [] }
  const res = await API.get(`/api/auth/history?token=${token}`)
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

export const importGitHubRepo = async (repoUrl, collectionName) => {
  const token = localStorage.getItem('token')
  const res = await API.post('/api/github/import', {
    repo_url: repoUrl,
    collection_name: collectionName,
    token: token
  })
  return res.data
}
export const deleteChatHistory = async (chatId) => {
  const token = localStorage.getItem('token')
  const res = await API.delete(`/api/auth/history/${chatId}?token=${token}`)
  return res.data
}

export const getRepoOverview = async (collectionName) => {
  const token = localStorage.getItem('token')
  const res = await API.post('/api/query/repo-overview', {
    collection_name: collectionName,
    token: token || null
  })
  return res.data
}

export const healthCheck = async () => {
  const res = await API.get('/api/health')
  return res.data
}