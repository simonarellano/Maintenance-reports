import client from './client'

export const formatosService = {
  listar: () =>
    client.get('/formatos'),

  obtener: (id) =>
    client.get(`/formatos/${id}`)
}
