const SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2D],
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  'application/vnd.ms-excel': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04],
};

const TEXT_MIMES = ['text/plain'];

function bufferMatches(buffer, signature) {
  if (!buffer || buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

function validateFileSignature(buffer, mimetype) {
  const type = (mimetype || '').toLowerCase();
  if (TEXT_MIMES.includes(type)) {
    const probe = buffer.subarray(0, 512);
    return !probe.includes(0);
  }
  const signature = SIGNATURES[type];
  if (!signature) return false;
  if (type === 'image/webp') {
    return bufferMatches(buffer, signature) && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  return bufferMatches(buffer, signature);
}

module.exports = { validateFileSignature };
