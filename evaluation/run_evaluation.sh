#!/bin/bash

CIRCUITS=("approach_1" "approach_2")
NUM_RUNS=10
DELAY_SECONDS=30
EVAL_SCRIPT_PATH="evaluation.js"

if [ ! -f "$EVAL_SCRIPT_PATH" ]; then
    echo "Error: Evaluation script not found at '$EVAL_SCRIPT_PATH'"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install it to run the evaluation script."
    exit 1
fi

for i in $(seq 1 $NUM_RUNS); do
    echo "--- Starting Run #$i of $NUM_RUNS ---"
    for circuit in "${CIRCUITS[@]}"; do
        echo -e "\n--- Evaluating circuit: $circuit ---"

        RESULTS_DIR="$circuit"
        mkdir -p "metrics_$RESULTS_DIR"
        node "$EVAL_SCRIPT_PATH" "$circuit"

        if [ $? -ne 0 ]; then
            echo "Error: Evaluation failed for circuit '$circuit' on run #$i. Stopping script."
            exit 1
        fi

        LATEST_METRIC_FILE=$(ls -t metrics_${circuit}_*.json 2>/dev/null | head -n 1)

        if [ -f "$LATEST_METRIC_FILE" ]; then
            mv "$LATEST_METRIC_FILE" "${RESULTS_DIR}/metrics_run_${i}.json"
            echo "Results for '$circuit' (Run #$i) saved to '${RESULTS_DIR}/metrics_run_${i}.json'"
        else
            echo "Warning: Could not find the output metrics file for '$circuit' on run #$i."
        fi
    done

    if [ $i -lt $NUM_RUNS ]; then
        echo -e "\n--- Run #$i completed. Waiting for $DELAY_SECONDS seconds... ---"
        sleep $DELAY_SECONDS
    fi
done

echo "--- All evaluations completed. ---"
