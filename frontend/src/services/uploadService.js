/**
 * Helpers de API para upload e exclusão de imagens de produtos e fornecedores.
 * @module services/uploadService
 */
import api from './api.js';


/**
 * Faz upload de product image.
 */
export const uploadProductImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file, file.name);

  return api.post('/upload/products', formData);
};


/**
 * Remove product image.
 */
export const deleteProductImage = async (filename) => {
  return api.delete('/upload/products', { data: { filename } });
};


/**
 * Faz upload de supplier image.
 */
export const uploadSupplierImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file, file.name);

  return api.post('/upload/suppliers', formData);
};


/**
 * Remove supplier image.
 */
export const deleteSupplierImage = async (filename) => {
  return api.delete('/upload/suppliers', { data: { filename } });
};
