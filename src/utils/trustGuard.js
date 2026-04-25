export const analyzePostTrust = (text) => {
  const lowercaseText = text.toLowerCase();
  const redFlags = [
    "official report says", "don't want you to know", 
    "secret revealed", "100% guaranteed", "confirmed by source"
  ];

  let score = 1.0;
  let flags = [];

  redFlags.forEach(phrase => {
    if (lowercaseText.includes(phrase)) {
      score -= 0.25;
      flags.push(phrase);
    }
  });

  const capsCount = (text.match(/[A-Z]/g) || []).length;
  if (capsCount > text.length * 0.3 && text.length > 10) {
    score -= 0.2;
    flags.push("excessive caps");
  }

  return {
    isVerified: score > 0.6,
    score: Math.max(0, score),
    flags
  };
};
