import { money, roundCOP } from "../src/lib/money";

const P = 1_220_000;
const targetPMT = 500_000;
const n = 3;

function runForRate(rate: number) {
  let balance = P;
  console.log(`\nRate: ${rate}`);
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * rate);
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
    console.log(`  Cuota #${k} | Int: ${interest} | Prin: ${principal} | Total: ${total} | Bal: ${balance}`);
  }
}

runForRate(0.1108);
runForRate(0.1109);
