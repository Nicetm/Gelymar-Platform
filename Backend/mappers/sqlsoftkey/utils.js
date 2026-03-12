const normalizeValue = (value) => {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '0') return null;
  // Soportar fechas en varchar tipo YYYY-MM-DD sin desfase
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Soportar fechas en varchar tipo DD-MM-YYYY o DD/MM/YYYY sin desfase de zona horaria
  const match = trimmed.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const parsed = Number(String(trimmed).replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeDecimal = (value, decimals = 2) => {
  const parsed = normalizeNumber(value);
  if (parsed === null) return null;
  return Number(parsed.toFixed(decimals));
};

module.exports = {
  normalizeValue,
  normalizeDate,
  normalizeNumber,
  normalizeDecimal,
};
