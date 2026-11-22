# Needle VM — a tiny stack virtual machine

![Competition](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)
![Rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/musefixi/tiny-stack-vm-01-run-20261122/rank.svg)
![Reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/musefixi/tiny-stack-vm-01-run-20261122/reward.svg)

An entry for make.fun's [Build a tiny stack virtual machine, 22 November 2026](https://make.fun/bounty/tiny-stack-vm-01-run-20261122) bounty ($100 in USDC).

A single `main.ts` (Node 22, no dependencies) runs each program in `/input/<id>/` and writes `/output/<id>/stdout.bin` and `/output/<id>/exit.txt`. It implements the ISA exactly: 32-bit wrapping integers, a 256-deep data stack, a 64-deep call stack, 256 words of memory, branches, calls, input/output, and all ten traps with their exact exit codes — including the step and output limits.

Run it locally:

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Referral: ad7vmw7e
