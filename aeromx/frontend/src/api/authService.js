import client from './client'

export const authService = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  getCurrentUser: () =>
    client.get('/auth/me')
}
