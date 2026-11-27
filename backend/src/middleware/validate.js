// Request validation with Joi. Schemas are lenient on unknown fields (older
// clients send extras that the routes already whitelist) but strict on the
// values that break GST maths or the database: dates, amounts, GSTIN, items.
const Joi = require('joi');

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const money = Joi.number().min(0).max(1e12);
const optMoney = money.allow(null, '');
const date = Joi.alternatives(Joi.date().iso(), Joi.string().valid('')).allow(null);
const gstin = Joi.string().trim().uppercase().pattern(GSTIN).allow('', null)
  .messages({ 'string.pattern.base': 'GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5' });

const item = Joi.object({
  quantity: Joi.number().min(0).max(1e9).allow(null, ''),
  rate: optMoney,
  gst_rate: Joi.number().min(0).max(40).allow(null, ''),
}).unknown(true);

const schemas = {
  invoice: Joi.object({
    invoice_date: date.required().messages({ 'any.required': 'Invoice date is required' }),
    due_date: date,
    customer_id: Joi.number().integer().positive().allow(null, ''),
    subtotal: optMoney, cgst_amount: optMoney, sgst_amount: optMoney, igst_amount: optMoney, total_amount: optMoney,
    items: Joi.array().items(item).max(500),
  }).unknown(true),
  purchase: Joi.object({
    bill_date: date,
    supplier_gstin: gstin,
    subtotal: optMoney, cgst_amount: optMoney, sgst_amount: optMoney, igst_amount: optMoney, total_amount: optMoney,
    items: Joi.array().items(item).max(500),
  }).unknown(true),
  customer: Joi.object({
    name: Joi.string().trim().min(1).max(200).required().messages({ 'any.required': 'Customer name is required', 'string.empty': 'Customer name is required' }),
    gstin,
    email: Joi.string().trim().email({ tlds: false }).allow('', null),
    phone: Joi.string().trim().max(20).allow('', null),
    pincode: Joi.string().trim().pattern(/^[0-9]{6}$/).allow('', null).messages({ 'string.pattern.base': 'Pincode must be 6 digits' }),
  }).unknown(true),
};

function validate(name, { partial = false } = {}) {
  const schema = partial ? schemas[name].fork(['invoice_date', 'name'].filter(k => schemas[name].describe().keys[k]), s => s.optional()) : schemas[name];
  return (req, res, next) => {
    const { error } = schema.validate(req.body || {}, { abortEarly: false, convert: true });
    if (!error) return next();
    const errors = error.details.map(d => ({ field: d.path.join('.'), msg: d.message.replace(/"/g, '') }));
    res.status(400).json({ success: false, msg: errors[0].msg, errors });
  };
}

module.exports = { validate, schemas, GSTIN };
