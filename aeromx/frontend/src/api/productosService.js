import client from './client'

// Catálogo multiproducto — reemplaza al viejo aeronavesService.
// `crear`/`actualizar` envían el atributo específico bajo `detalle`.
export const productosService = {
  listar: (params) =>
    client.get('/productos', { params }),

  obtener: (id) =>
    client.get(`/productos/${id}`),

  crear: (data) =>
    client.post('/productos', data),

  actualizar: (id, data) =>
    client.put(`/productos/${id}`, data),

  desactivar: (id) =>
    client.delete(`/productos/${id}`),
}
