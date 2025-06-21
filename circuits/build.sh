#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Argument missing."
  exit 1
fi

CIRCUIT_NAME="$1"

set -e

bash compile.sh $CIRCUIT_NAME
bash witness.sh $CIRCUIT_NAME
bash proof_fast.sh $CIRCUIT_NAME

if [ $? -eq 0 ]; then
  echo -e "\e[32mSuccess\e[0m"
else
  echo -e "\e[31mFailure\e[0m"
fi