#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Argument missing."
  exit 1
fi

set -e

CIRCUIT_NAME="$1"
JS_PATH=build/"$CIRCUIT_NAME"/"$CIRCUIT_NAME"_js/

node $JS_PATH/generate_witness.js $JS_PATH/"$CIRCUIT_NAME.wasm" "$CIRCUIT_NAME"_input.json build/"$CIRCUIT_NAME"/witness.wtns

if [ $? -eq 0 ]; then
  echo -e "\e[32mSuccess\e[0m"
else
  echo -e "\e[31mFailure\e[0m"
fi