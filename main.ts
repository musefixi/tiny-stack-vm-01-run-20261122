// Needle VM: a tiny stack VM in one file (Node 22, no deps).
// Runs /input/<id>/program.bin on input.bin, writes /output/<id>/
// stdout.bin + exit.txt. 32-bit wrapping ints, 256-deep stack,
// 64-deep call stack, 256 words of memory, traps 2..11.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Runs one program. Returns [stdout bytes, exit code 0..255].
function run(prog, inp) {
  const n = prog.length;
  const st = new Int32Array(256);
  let sp = 0;
  const cs = new Int32Array(64);
  let cp = 0;
  const mem = new Int32Array(256);
  const out = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, steps = 0;
  const end = (code) => [out.subarray(0, ol), code];

  for (;;) {
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = prog[pc];
    // Valid: 00-07, 10-1E, 20-22, 30-34, 40-41, 50-53.
    const known = op < 8 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34)
      || (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83);
    if (!known) return end(5);
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + imm >= n) return end(9);
    steps++;
    const nx = pc + 1 + imm;
    // Stack needs: pops / pushes per opcode.
    let pops = 0, push = 0;
    if (op === 7) { pops = 3; push = 3; }
    else if (op === 5 || op === 6 || op === 65 || (op >= 16 && op <= 22)
      || (op >= 24 && op <= 26) || (op >= 28 && op <= 30) || (op >= 32 && op <= 34)) {
      pops = 2; push = op === 5 || op === 65 ? 0 : op === 6 ? 3 : 1;
    } else if (op === 3 || op === 4 || op === 23 || op === 27 || op === 49
      || op === 50 || op === 64 || op === 80 || op === 81 || op === 83) {
      pops = 1; push = op === 4 ? 2 : op === 23 || op === 27 || op === 64 ? 1 : 0;
    } else if (op === 1 || op === 2 || op === 82) push = 1;
    if (sp < pops) return end(2);
    if (sp - pops + push > 256) return end(3);
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: st[sp++] = (prog[nx - 1] << 24) >> 24; break;
      case 2: st[sp++] = prog[nx - 4] | (prog[nx - 3] << 8) | (prog[nx - 2] << 16) | (prog[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: st[sp] = st[sp - 1]; sp++; break;
      case 5: { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; break; }
      case 6: st[sp] = st[sp - 2]; sp++; break;
      case 7: { const a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a; break; }
      case 23: st[sp - 1] = -st[sp - 1] | 0; break;
      case 27: st[sp - 1] = ~st[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30:
      case 32: case 33: case 34: {
        const b = st[sp - 1], a = st[sp - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) {
          if (b === 0) return end(4);
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 20) {
          if (b === 0) return end(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 21) {
          if (b === 0) return end(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 22) {
          if (b === 0) return end(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        st[sp++] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) { const v = st[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        cs[cp++] = nx;
        pc = prog[nx - 2] | (prog[nx - 1] << 8);
        break;
      case 52:
        if (cp === 0) return end(8);
        pc = cs[--cp];
        break;
      case 64: {
        const addr = st[sp - 1];
        if (addr < 0 || addr > 255) return end(6);
        st[sp - 1] = mem[addr];
        break;
      }
      case 65: { // ( v addr -- )
        const addr = st[sp - 1], v = st[sp - 2];
        if (addr < 0 || addr > 255) return end(6);
        sp -= 2;
        mem[addr] = v;
        break;
      }
      case 80: {
        const s = String(st[sp - 1]);
        if (ol + s.length > 65536) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) out[ol++] = s.charCodeAt(i);
        break;
      }
      case 81:
        if (ol + 1 > 65536) return end(11);
        out[ol++] = st[--sp] & 255;
        break;
      case 82:
        st[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 83: return end(st[--sp] & 255);
    }
  }
}

for (const id of readdirSync(IN_DIR).sort()) {
  const prog = readFileSync(join(IN_DIR, id, 'program.bin'));
  const inp = readFileSync(join(IN_DIR, id, 'input.bin'));
  const [stdout, exit] = run(prog, inp);
  mkdirSync(join(OUT_DIR, id), { recursive: true });
  writeFileSync(join(OUT_DIR, id, 'stdout.bin'), stdout);
  writeFileSync(join(OUT_DIR, id, 'exit.txt'), exit + '\n');
}
