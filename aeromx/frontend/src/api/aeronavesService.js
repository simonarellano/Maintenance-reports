import client from './client'

export const aeronavesService = {
  listar: () =>
    client.get('/aeronaves'),

  obtener: (id) =>
    client.get(`/aeronaves/${id}`)
}
