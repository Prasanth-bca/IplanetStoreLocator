/**
 * Customer enquiry helpers: validation, the WhatsApp message format and the paste shortcut label.
 * Pure functions with no browser or server dependencies beyond what the parameters carry.
 */

export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/';

export interface EnquiryInput {
  customerName: string;
  customerMobile: string;
  storeName: string;
  posCode: string;
  product: string;
  remarks: string;
}

export type EnquiryField = 'customerName' | 'customerMobile' | 'storeName' | 'product';
export type EnquiryErrors = Partial<Record<EnquiryField, string>>;

const NAME_MAX = 80;
const PRODUCT_MAX = 120;
const REMARKS_MAX = 500;

/** Collapses newlines and repeated spaces so a single-line field can't break the message layout. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Accepts an Indian mobile number as typed (spaces, dashes, +91, 91 or a leading 0) and
 * returns the 10 digits, or null when it isn't a valid mobile number.
 */
export function normalizeMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function formatMobile(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function validateEnquiry(input: EnquiryInput): { valid: boolean; errors: EnquiryErrors } {
  const errors: EnquiryErrors = {};

  const name = oneLine(input.customerName);
  if (!name) errors.customerName = 'Enter the customer name.';
  else if (name.length < 2) errors.customerName = 'Enter the customer’s full name.';
  else if (name.length > NAME_MAX) errors.customerName = `Keep the name under ${NAME_MAX} characters.`;

  if (!input.customerMobile.trim()) errors.customerMobile = 'Enter the customer’s mobile number.';
  else if (!normalizeMobile(input.customerMobile)) errors.customerMobile = 'Enter a valid 10-digit Indian mobile number.';

  if (!oneLine(input.storeName) || !oneLine(input.posCode)) errors.storeName = 'No store is selected.';

  const product = oneLine(input.product);
  if (!product) errors.product = 'Enter the product or model.';
  else if (product.length > PRODUCT_MAX) errors.product = `Keep the product under ${PRODUCT_MAX} characters.`;

  return { valid: Object.keys(errors).length === 0, errors };
}

/** The message the CEC pastes into a WhatsApp group. Call validateEnquiry first. */
export function buildEnquiryMessage(input: EnquiryInput): string {
  const mobile = normalizeMobile(input.customerMobile);
  const remarks = input.remarks.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, REMARKS_MAX);

  return [
    'iPlanet – New Customer Enquiry',
    '',
    `Preferred Store: ${oneLine(input.storeName)}`,
    `POS Code: ${oneLine(input.posCode)}`,
    `Customer Name: ${oneLine(input.customerName)}`,
    `Customer Mobile: ${mobile ? formatMobile(mobile) : oneLine(input.customerMobile)}`,
    `Product / Model: ${oneLine(input.product)}`,
    `Remarks: ${remarks || 'None'}`,
    '',
    'Please contact the customer and confirm product availability before the visit.',
  ].join('\n');
}

/** How to paste on the user's device, for the success message. */
export function pasteShortcutLabel(userAgent: string, platform: string, maxTouchPoints = 0): string {
  const isPhoneOrTablet =
    /android|iphone|ipad|ipod/i.test(userAgent) || (/mac/i.test(platform) && maxTouchPoints > 1);
  if (isPhoneOrTablet) return 'paste (long-press the message box)';
  if (/mac/i.test(platform)) return 'Cmd + V';
  return 'Ctrl + V';
}
