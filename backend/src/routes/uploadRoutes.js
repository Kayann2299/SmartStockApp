/**
 * Expõe rotas de upload e gerenciamento de imagens para ativos de produto e fornecedor.
 * @module routes/uploadRoutes
 */
import express from 'express';
import { uploadProducts, uploadSuppliers } from '../services/uploadService.js';
import { 
  uploadProductImage, uploadSupplierImage,
  deleteProductImage, deleteSupplierImage 
} from '../controllers/uploadController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/products', authMiddleware, uploadProducts.single('image'), uploadProductImage);
router.delete('/products', authMiddleware, deleteProductImage);
router.post('/suppliers', authMiddleware, uploadSuppliers.single('image'), uploadSupplierImage);
router.delete('/suppliers', authMiddleware, deleteSupplierImage);

export default router;
