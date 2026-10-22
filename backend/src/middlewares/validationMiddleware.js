/**
 * Helpers de middleware para validar os payloads das requisições.
 * @module middlewares/validationMiddleware
 */
export const validateRequiredFields = (fields = []) => {
  return (req, res, next) => {
    const missing = fields.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null || req.body?.[field] === '');
    if (missing.length > 0) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }
    next();
  };
};

/**
 * Valida array.
 */
export const validateArray = (field) => {
  return (req, res, next) => {
    if (!Array.isArray(req.body?.[field]) || req.body[field].length === 0) {
      return res.status(400).json({ message: `The field ${field} must be a non-empty array.` });
    }
    next();
  };
};
