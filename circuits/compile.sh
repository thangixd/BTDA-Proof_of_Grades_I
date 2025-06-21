#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Argument missing."
  exit 1
fi

CIRCUIT_NAME="$1"

set -e

mkdir -p "build/$CIRCUIT_NAME"
circom "$CIRCUIT_NAME.circom" --output "build/$CIRCUIT_NAME/" --r1cs --wasm --sym -l ../node_modules

if [ $? -eq 0 ]; then
  echo -e "\e[32mSuccess\e[0m"
else
  echo -e "\e[31mFailure\e[0m"
fi