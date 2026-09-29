const env = require('../src/config/env');

const requiredInProduction = [
  'NODE_ENV',
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'SERVER_URL',
  'CLIENT_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const hasPlaceholder = (value) => {
  if (!value) return true;
  const v = String(value).trim();
  return /xxxx|change-this|placeholder|example|your_|localhost/i.test(v) || v === 'file:./dev.db';
};

const errors = [];

for (const key of requiredInProduction) {
  const value = process.env[key] ?? env[key];
  if (hasPlaceholder(value)) {
    errors.push(`${key} is missing or still using a placeholder value.`);
  }
}

if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production') {
  if (errors.length > 0) {
    console.error('Production environment check failed:');
    errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  }

  console.log('Production environment check passed.');
} else {
  console.log('Development environment detected; env check is informational only.');
  if (errors.length > 0) {
    console.warn('Warnings:');
    errors.forEach((err) => console.warn(` - ${err}`));
  }
}
