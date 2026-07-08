export {};

const P = 2_500_000;
const targetPMT = 787_500;
const n = 4;

let bestRate = 0;
let minDiff = Infinity;
let finalDirection = 1;

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
    finalDirection = lastTotal > targetPMT ? 1 : -1;
  }
}

console.log(`Best 4-decimal rate: ${bestRate} (rate * 100 = ${(bestRate * 100).toFixed(2)}%)`);
console.log(`Last installment total: ${targetPMT + (minDiff * finalDirection)}`);

// Now let's print the actual schedule generated with this rate
let balance = P;
let totalInterest = 0;
let totalPaid = 0;
console.log("\nSchedule with best rate:");
for (let k = 1; k <= n; k++) {
  const interest = Math.round(balance * bestRate);
  let principal: number;
  let total: number;
  if (k === n) {
    principal = balance;
    total = principal + interest;
    balance = 0;
  } else {
    total = targetPMT;
    principal = total - interest;
    balance = balance - principal;
  }
  totalInterest += interest;
  totalPaid += total;
  console.log(`  Cuota #${k} | Principal: ${principal} | Interest: ${interest} | Total: ${total} | Balance: ${balance}`);
}
console.log(`Total Interest: ${totalInterest}`);
console.log(`Total Paid: ${totalPaid}`);
