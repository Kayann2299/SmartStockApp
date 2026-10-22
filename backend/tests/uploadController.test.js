import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadProductImage, uploadSupplierImage } from '../src/controllers/uploadController.js';

test('uploadProductImage returns a relative public URL for uploaded images', async () => {
  const req = {
    file: {
      filename: 'products_12345.png',
      originalname: 'product.png',
      size: 2048,
    },
    protocol: 'http',
    get: (header) => header === 'host' ? 'localhost:5001' : undefined,
  };

  const res = {
    payload: null,
    statusCode: 200,
    json(payload) {
      this.payload = payload;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };

  await uploadProductImage(req, res);

  assert.equal(res.payload.url, '/uploads/products/products_12345.png');
});

test('uploadSupplierImage returns a relative public URL for uploaded images', async () => {
  const req = {
    file: {
      filename: 'suppliers_67890.webp',
      originalname: 'supplier.webp',
      size: 1024,
    },
    protocol: 'http',
    get: (header) => header === 'host' ? 'localhost:5001' : undefined,
  };

  const res = {
    payload: null,
    statusCode: 200,
    json(payload) {
      this.payload = payload;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };

  await uploadSupplierImage(req, res);

  assert.equal(res.payload.url, '/uploads/suppliers/suppliers_67890.webp');
});
