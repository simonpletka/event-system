/**
 * Czech "QR Platba" payment string (SPD — Short Payment Descriptor, spec at
 * qr-platba.cz). Amount is in whole CZK per the rest of this app; SPD wants
 * two decimal places.
 */
export function buildQrPaymentString(params: {
  iban: string;
  amount: number;
  variableSymbol: string;
  message: string;
}) {
  const amount = params.amount.toFixed(2);
  const iban = params.iban.replace(/\s+/g, "");
  const message = params.message.slice(0, 60).replace(/\*/g, "");
  return `SPD*1.0*ACC:${iban}*AM:${amount}*CC:CZK*X-VS:${params.variableSymbol}*MSG:${message}`;
}
