import crypto from 'crypto';

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString('base64');
}

const lines = [
  `APP_KEYS=${randomBase64(16)},${randomBase64(16)}`,
  `API_TOKEN_SALT=${randomBase64(16)}`,
  `ADMIN_JWT_SECRET=${randomBase64(16)}`,
  `TRANSFER_TOKEN_SALT=${randomBase64(16)}`,
  `JWT_SECRET=${randomBase64(16)}`,
  `ENCRYPTION_KEY=${randomBase64(32)}`,
];

console.log(lines.join('\n'));
