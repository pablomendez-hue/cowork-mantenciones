// Nombres oficiales de insumos. Todo dato histórico o nuevo pasa por aquí para
// que catálogo, inventario, historial y lista de compras usen el mismo nombre.
const PRODUCT_NAME_MAP = Object.freeze({
  "Aceite de Oliva": "Aceite de Oliva 1L",
  "Alcohol 5 L": "Alcohol 1 L",
  "Bolsas Basura": "",
  "Estevia": "Stevia",
  "Galón 5L Aceite de Oliva": "Aceite de Oliva 1L",
  "Guantes": "",
  "Lisoform": "Lysoform",
  "Papel Higiénico rollo": "Papel Higiénico",
  "Revolvedor": "Revolvedores",
  "Señaleticas": "",
  "Té": "",
  "Vinagre": "Vinagre Rosado",
});

export function canonicalProducto(producto) {
  const name = String(producto || "").trim();
  return Object.prototype.hasOwnProperty.call(PRODUCT_NAME_MAP, name)
    ? PRODUCT_NAME_MAP[name]
    : name;
}

export function isDeletedProducto(producto) {
  return Boolean(String(producto || "").trim()) && !canonicalProducto(producto);
}

