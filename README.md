# Proof of Grades Project

This project explores different approaches to proving academic grades using zero-knowledge proofs.


## Installation

To get started, clone the repository and navigate into the project directory:

```
git clone https://github.com/thangixd/BTDA-Proof_of_Grades_I.git
cd BTDA-Proof_of_Grades_I
``` 

## Requirements

Before you begin, ensure you have the following installed on your system:

* Node.js and npm: These are essential for running the project's JavaScript dependencies.
        [Download and Install Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
* Circom: This is a circuit compiler used for generating zk-SNARK circuits. Only needed if you want to compile the circuits on your own.
        [Circom Installation Guide](https://docs.circom.io/getting-started/installation/)

## Setup
Once you've installed the requirements, set up the project by installing its dependencies and compiling the contracts:

``` 
npm install
npx hardhat compile
```

## Execution

You can run the tests for the two different approaches to grade awarding. Each approach is tested independently:

```
npx hardhat test test/approach_1_award.ts
npx hardhat test test/approach_2_award.ts
```

## Compile and build circuits

Follow the [instructions](https://docs.circom.io/getting-started/compiling-circuits/) or use the shell scripts below.

```
cd circuits
bash build.sh approach_1
bash build.sh approach_2
```

Use `sh` if you are on macOS or linux.

## Evaluation
Script and results for oure evaluation are at `./evaluation`. If you wish to collect metrics yourself, you may follow these steps from the root directory:
1. Create new artifacts. This utalizes the same logic as in `Compile and build circuits`, but tracks metrics during the execution.
```
cd evaluation
bash run_evaluation.sh
```
Or to generate single runs:
```
node evaluation.js approach_1
node evaluation.js approach_2
```
2. Plot the results. This requires a python environment. We recommend seting up a virtual environment. In the root directory of the project execute
```
// in some macOS setups you might need to use python3 instead of python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd evaluation
python plot_metrics.py metrics_approach_1 metrics_approach_2
```