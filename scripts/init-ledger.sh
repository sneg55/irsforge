#!/bin/bash
set -e
cd "$(dirname "$0")/../contracts"
daml script \
  --dar .daml/dist/irsforge-contracts-0.0.1.dar \
  --script-name Setup.Init:init \
  --ledger-host localhost \
  --ledger-port 6865
echo "Ledger initialized."
