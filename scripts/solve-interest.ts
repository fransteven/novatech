import { generateSchedule } from "../src/lib/credit/amortization";

const P = 1_220_000;
const targetPMT = 500_000;
const n = 3;

// Find interest rate r using binary search
let low = 0.0001;
let high = 0.50; // up to 50% monthly
let rate = 0;

for (let step = 0; step < 100; step++) {
  const mid = (low + high) / 2;
  // PMT = P * r / (1 - (1+r)^-n)
  const denom = 1 - Math.pow(1 + mid, -n);
  const pmt = (P * mid) / denom;
  
  if (pmt > targetPMT) {
    high = mid;
  } else {
    low = mid;
  }
  rate = mid;
}

console.log(`Solved rate: ${rate} (${(rate * 100).toFixed(4)}%)`);

// Let's test with rounded rate to 4 decimal places
const roundedRate = Math.round(rate * 10000) / 10000;
console.log(`Rounded rate to 4 decimal places: ${roundedRate}`);

const schedule = generateSchedule({
  principal: P,
  monthlyRate: roundedRate,
  termMonths: n,
  startDate: new Date("2026-06-05T12:00:00.000Z"),
});

console.log("\nSchedule with rounded rate:");
let totalInterest = 0;
let totalPaid = 0;
for (const entry of schedule) {
  console.log(
    `  Cuota #${entry.number} | Due: ${entry.dueDate.toISOString().slice(0, 10)} | Principal: ${entry.principal} | Interest: ${entry.interest} | Total: ${entry.totalAmount} | Balance: ${entry.remainingBalance}`
  );
  totalInterest += entry.interest;
  totalPaid += entry.totalAmount;
}
console.log(`Total Interest: ${totalInterest}`);
console.log(`Total Paid: ${totalPaid}`);
