
/**
 * Middleware que restringe o acesso com base na função do usuário autenticado.
 * @module middlewares/roleMiddleware
 */
/**
 * Cria um middleware Express que só deixa a requisição prosseguir se a
 * função (role) do usuário autenticado estiver entre as permitidas.
 *
 * @param {string[]} [roles=[]] Lista de roles permitidas para a rota.
 * @returns {import('express').RequestHandler} Middleware de autorização.
 */
export const roleMiddleware = (roles = []) => {
  /**
   * Normaliza uma role para comparação (minúsculas, sem espaços extra).
   *
   * @param {string} r Role em bruto.
   * @returns {string} Role normalizada.
   */
  const normalize = (r) => (String(r || '').trim().toLowerCase());
  /**
   * Mapeia nomes de roles em português (usados em dados de seed) para os
   * nomes internos em inglês usados no controlo de acesso.
   *
   * @param {string} r Role em bruto.
   * @returns {string} Role normalizada e mapeada.
   */
  const mapRole = (r) => {
    const rr = normalize(r);
    // support Portuguese role names commonly used in seed data
    if (rr === 'gerente') return 'manager';
    if (rr === 'administrador') return 'admin';
    return rr;
  };

  const allowed = new Set(roles.map((r) => normalize(r)));

  return (req, res, next) => {
    const userRoleRaw = req.user?.role;
    const userRole = mapRole(userRoleRaw);

    if (!userRole) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!allowed.has(userRole) && !allowed.has(mapRole(userRoleRaw))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    next();
  };
};
