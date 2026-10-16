// Fields the signed-in app needs to show the company brand and address.
// Never return credentials, mail-provider secrets, bank account numbers or
// unrelated database columns in login/me responses.
function publicOrganization(org) {
  if (!org) return null;
  const fields = ['id', 'name', 'gstin', 'address', 'city', 'state', 'state_code',
    'pincode', 'phone', 'email', 'logo_url'];
  return Object.fromEntries(fields.filter(key => org[key] !== undefined)
    .map(key => [key, org[key]]));
}

function settingsOrganization(org, isAdmin) {
  if (!org) return null;
  if (isAdmin) {
    const { smtp_pass, resend_api_key, ...safe } = org;
    return { ...safe, smtp_pass_set: !!smtp_pass, resend_api_key_set: !!resend_api_key };
  }
  const fields = ['id', 'name', 'gstin', 'address', 'city', 'state', 'state_code',
    'pincode', 'phone', 'email', 'logo_url', 'stamp_url', 'signature_url',
    'letterhead_url', 'letterhead_footer_url', 'invoice_prefix', 'quotation_prefix',
    'print_letterhead_mm', 'print_footer_mm', 'invoice_font_family',
    'invoice_font_size', 'quotation_font_family', 'quotation_font_size'];
  return Object.fromEntries(fields.filter(key => org[key] !== undefined)
    .map(key => [key, org[key]]));
}

// Document rendering needs bank details but never mail credentials or provider keys.
function documentOrganization(org) {
  if (!org) return null;
  const fields = ['id', 'name', 'gstin', 'address', 'city', 'state', 'state_code',
    'pincode', 'phone', 'email', 'logo_url', 'stamp_url', 'signature_url',
    'letterhead_url', 'letterhead_footer_url', 'bank_name', 'account_no',
    'ifsc', 'branch', 'upi_id', 'print_letterhead_mm', 'print_footer_mm',
    'invoice_prefix', 'quotation_prefix'];
  return Object.fromEntries(fields.filter(key => org[key] !== undefined)
    .map(key => [key, org[key]]));
}

module.exports = { publicOrganization, settingsOrganization, documentOrganization };
