export {};

const P = 1_220_000;
const targetPMT = 500_000;
const n = 3;

let bestRate = 0;
let minDiff = Infinity;

for (let r = 0; r <= 2000; r++) {
  const rate = r / 10000; // e.g. 0.0001 step
  let balance = P;
  let lastTotal = 0;
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * rate);
    let principal: number;
    let total: number;
    if (k === n) {
      principal = balance;
      total = principal + interest;
      balance = 0;
      lastTotal = total;
    } else {
      total = targetPMT;
      principal = total - interest;
      balance = balance - principal;
    }
  }
  const diff = Math.abs(lastTotal - targetPMT);
  if (diff < minDiff) {
    minDiff = diff;
    bestRate = rate;
  }
}

console.log(`Best 4-decimal rate: ${bestRate} with last installment total: ${targetPMT + (minDiff * (bestRate > 0.1108 ? 1 : -1))}`);
