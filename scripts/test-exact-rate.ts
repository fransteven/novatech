import { generateSchedule } from "../src/lib/credit/amortization";

const P = 3_220_000;
const rate = 0.03937295; // 3.937295% monthly
const n = 6;
const startDate = new Date("2026-06-17T12:00:00.000Z");

const schedule = generateSchedule({
  principal: P,
  monthlyRate: rate,
  termMonths: n,
  startDate,
});

console.log("Generated Schedule with 0.03937295:");
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
