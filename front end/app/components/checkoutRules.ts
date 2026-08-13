export const CHECKOUT_PROMO_CODE = "SOUVENOTE10";

export type CheckoutCardDetails = {
  number: string;
  exp: string;
  cvc: string;
  postal: string;
};

export type CheckoutFieldErrors = Partial<Record<keyof CheckoutCardDetails, string>>;

export type CheckoutTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  taxLabel: string;
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isCheckoutPromoCode(value: string) {
  return value.trim().toUpperCase() === CHECKOUT_PROMO_CODE;
}

export function calculateCheckoutTotals(subtotal: number, country: string, promoApplied: boolean): CheckoutTotals {
  const safeSubtotal = Math.max(0, roundCurrency(subtotal));
  const discount = promoApplied ? roundCurrency(safeSubtotal * 0.1) : 0;
  const taxable = safeSubtotal - discount;
  const taxRate = country === "CA" ? 0.05 : country === "GB" ? 0.2 : 0;
  const taxLabel = country === "CA" ? "GST (5%)" : country === "GB" ? "VAT (20%)" : "Tax";
  const tax = roundCurrency(taxable * taxRate);

  return {
    subtotal: safeSubtotal,
    discount,
    tax,
    total: roundCurrency(taxable + tax),
    taxLabel,
  };
}

function passesLuhnCheck(value: string) {
  let sum = 0;
  let doubleDigit = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

export function validateCheckoutCard(card: CheckoutCardDetails, now = new Date()): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const cardNumber = card.number.replace(/\D/g, "");

  if (cardNumber.length < 13 || cardNumber.length > 19 || !passesLuhnCheck(cardNumber)) {
    errors.number = "Enter a valid card number.";
  }

  const expiryDigits = card.exp.replace(/\D/g, "");
  if (expiryDigits.length !== 4) {
    errors.exp = "Enter an expiry date as MM / YY.";
  } else {
    const month = Number(expiryDigits.slice(0, 2));
    const year = 2000 + Number(expiryDigits.slice(2));
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (month < 1 || month > 12 || year < currentYear || (year === currentYear && month < currentMonth)) {
      errors.exp = "Enter a future expiry date.";
    }
  }

  if (!/^\d{3,4}$/.test(card.cvc)) {
    errors.cvc = "Enter a 3 or 4 digit security code.";
  }

  if (card.postal.trim().length < 3) {
    errors.postal = "Enter your billing postal code.";
  }

  return errors;
}
