#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Argument missing."
  exit 1
fi

CIRCUIT_NAME="$1"

bash compile.sh $CIRCUIT_NAME
bash witness.sh $CIRCUIT_NAME
bash proof_fast.sh $CIRCUIT_NAME