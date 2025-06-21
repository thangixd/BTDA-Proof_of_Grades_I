#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Argument missing."
  exit 1
fi

LEVEL=16
PTAU_PATH=Power-of-Tau

CIRCUIT_NAME="$1"
BUILD_PATH=build/"$CIRCUIT_NAME"
PTAU_PATH=build/"$PTAU_PATH"
JS_PATH=build/"$CIRCUIT_NAME"/"$CIRCUIT_NAME"_js

set -e

snarkjs groth16 setup "$BUILD_PATH"/"$CIRCUIT_NAME".r1cs "$PTAU_PATH"/pot"$LEVEL"_final.ptau "$PTAU_PATH"/"$CIRCUIT_NAME"_0000.zkey
snarkjs zkey contribute "$PTAU_PATH"/"$CIRCUIT_NAME"_0000.zkey "$PTAU_PATH"/"$CIRCUIT_NAME"_0001.zkey -v <<< "1234"
snarkjs zkey export verificationkey "$PTAU_PATH"/"$CIRCUIT_NAME"_0001.zkey "$BUILD_PATH"/verification_key.json
snarkjs groth16 prove "$PTAU_PATH"/"$CIRCUIT_NAME"_0001.zkey "$BUILD_PATH"/witness.wtns "$BUILD_PATH"/proof.json "$BUILD_PATH"/public.json
snarkjs groth16 verify "$BUILD_PATH"/verification_key.json "$BUILD_PATH"/public.json "$BUILD_PATH"/proof.json
snarkjs zkey export solidityverifier "$PTAU_PATH"/"$CIRCUIT_NAME"_0001.zkey ../contracts/$CIRCUIT_NAME/verifier.sol

if [ $? -eq 0 ]; then
  echo -e "\e[32mSuccess\e[0m"
else
  echo -e "\e[31mFailure\e[0m"
fi