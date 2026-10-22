/**
 * Auxiliar simulado para envio de SMS usado pela aplicação.
 * @module config/sms
 */
export const sendSMS = async ({ to, message }) => {
  console.log('[sms] sms simulado:', { to, message });
  return { success: true, messageId: `sms_${Date.now()}` };
};
