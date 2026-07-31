const DANGEROUS_KEYWORDS = [
  'bear',
  'elephant',
  'wolf',
  'lion',
  'tiger',
  'leopard',
  'crocodile',
  'alligator',
  'snake',
  'cobra',
];

export function isDangerousDetection(alert) {
  if (!alert?.animal_detected) return false;
  if (typeof alert.dangerous === 'boolean') return alert.dangerous;

  const animalType = String(alert.animal_type || '').toLowerCase();
  return DANGEROUS_KEYWORDS.some(keyword => animalType.includes(keyword));
}

