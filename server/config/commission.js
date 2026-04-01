/**
 * Configuración de comisiones de la plataforma
 * Centraliza toda la lógica de cálculo de comisiones
 */

/**
 * Obtiene la configuración de comisiones desde variables de entorno
 * o usa valores por defecto seguros
 */
export function getCommissionConfig() {
  return {
    // Comisión base (15% por defecto)
    baseRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15'),
    
    // Comisión mínima (5%)
    minRate: parseFloat(process.env.PLATFORM_COMMISSION_MIN || '0.05'),
    
    // Comisión máxima (10% para altos volúmenes)
    maxRate: parseFloat(process.env.PLATFORM_COMMISSION_MAX || '0.10'),
    
    // Tasa para pagos instantáneos (5.99%)
    instantRate: parseFloat(process.env.PLATFORM_INSTANT_RATE || '0.0599'),
    
    // Tasa para pagos en cuotas (3.0378%)
    installmentsRate: parseFloat(process.env.PLATFORM_INSTALLMENTS_RATE || '0.030378'),
  };
}

/**
 * Calcula la comisión basada en el volumen de servicios completados
 * La comisión decrece con más servicios (incentivo de fidelidad)
 * 
 * @param {number} completedServices - Número de servicios completados por el provider
 * @returns {number} - Tasa de comisión (0.05 a 0.15)
 */
export function calculateCommissionRate(completedServices = 0) {
  const config = getCommissionConfig();
  
  // Lógica de comisión decreciente
  if (completedServices >= 50) {
    return config.minRate; // 5% para providers muy activos
  } else if (completedServices >= 20) {
    return 0.08; // 8% para providers activos
  } else if (completedServices >= 10) {
    return 0.10; // 10% para providers moderados
  } else if (completedServices >= 5) {
    return 0.12; // 12% para providers nuevos
  }
  
  return config.baseRate; // 15% para nuevos
}

/**
 * Calcula el monto de la comisión para un servicio
 * 
 * @param {number} totalAmount - Monto total del servicio
 * @param {number} completedServices - Número de servicios completados por el provider
 * @returns {object} - Objeto con desglose de comisiones
 */
export function calculateCommission(totalAmount, completedServices = 0) {
  const rate = calculateCommissionRate(completedServices);
  const commissionAmount = totalAmount * rate;
  const providerAmount = totalAmount - commissionAmount;
  
  return {
    totalAmount,
    commissionRate: rate,
    commissionAmount,
    providerAmount,
    completedServices,
  };
}

/**
 * Calcula el monto con comisión para pago instantáneo
 */
export function calculateInstantPayment(totalAmount) {
  const config = getCommissionConfig();
  const commissionAmount = totalAmount * config.instantRate;
  
  return {
    totalAmount,
    commissionRate: config.instantRate,
    commissionAmount,
    providerAmount: totalAmount - commissionAmount,
    paymentType: 'instant',
  };
}

/**
 * Calcula el monto con comisión para pago en cuotas
 */
export function calculateInstallmentsPayment(totalAmount, installments = 1) {
  const config = getCommissionConfig();
  const commissionAmount = totalAmount * config.installmentsRate;
  
  return {
    totalAmount,
    installments,
    commissionRate: config.installmentsRate,
    commissionAmount,
    providerAmount: totalAmount - commissionAmount,
    paymentType: 'installments',
  };
}

/**
 * Valida que una comisión esté dentro de los límites permitidos
 */
export function isValidCommissionRate(rate) {
  const config = getCommissionConfig();
  return rate >= config.minRate && rate <= config.baseRate;
}
