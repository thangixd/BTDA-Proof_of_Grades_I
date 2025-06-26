const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const pidusage = require('pidusage');

/**
 * @param {string} command
 * @param {string[]} args
 * @param {object} options
 * @param {boolean} [options.silent=false]
 * @param {boolean} [options.captureOutput=false]
 * @param {boolean} [options.monitorProcess=false]
 * @returns {Promise<{durationMs: number, stdout: string, stderr: string, maxMemoryBytes: number, maxCpuPercent: number}>}
 */
async function runCommandAndMeasure(command, args, options = {}) {
    const { silent = false, captureOutput = false, monitorProcess = false } = options;

    let stdout = '';
    let stderr = '';
    let maxMemoryBytes = 0;
    let maxCpuPercent = 0;

    const startTime = process.hrtime.bigint();
    let childProcess;

    const promise = new Promise((resolve, reject) => {
        childProcess = spawn(command, args, { stdio: silent ? 'pipe' : 'inherit' });

        if (captureOutput) {
            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
        }

        let intervalId;
        if (monitorProcess) {
            setTimeout(() => {
                intervalId = setInterval(async () => {
                    try {
                        const stats = await pidusage(childProcess.pid);
                        maxMemoryBytes = Math.max(maxMemoryBytes, stats.memory);
                        maxCpuPercent = Math.max(maxCpuPercent, stats.cpu);
                    } catch (e) {
                    }
                }, 50);
            }, 50);
        }

        childProcess.on('close', (code) => {
            if (intervalId) clearInterval(intervalId);
            const endTime = process.hrtime.bigint();
            const durationMs = Number(endTime - startTime) / 1_000_000;

            if (code === 0) {
                resolve({ durationMs, stdout, stderr, maxMemoryBytes, maxCpuPercent });
            } else {
                reject(new Error(`Command '${command} ${args.join(' ')}' exited with code ${code}. Stderr: ${stderr}`));
            }
        });

        childProcess.on('error', (err) => {
            if (intervalId) clearInterval(intervalId);
            reject(new Error(`Failed to start command '${command}': ${err.message}`));
        });
    });

    return promise;
}

/**
 * @param {string} circuitName
 * @param {number} ptauLevel
 * @returns {Promise<object>}
 */
async function evaluateCircuit(circuitName, ptauLevel = 16) {
    const results = {
        circuitName: circuitName,
        timestamp: new Date().toISOString(),
        metrics: {}
    };

    const ROOT_DIR = path.resolve(__dirname, '..');
    const CIRCUIT_DIR = path.join(ROOT_DIR, 'circuits');
    const BUILD_DIR = path.join(CIRCUIT_DIR, 'build', circuitName);
    const JS_PATH = path.join(BUILD_DIR, `${circuitName}_js`);
    const PTAU_DIR = path.join(CIRCUIT_DIR, 'build', 'Power-of-Tau');
    const CONTRACTS_DIR = path.join(ROOT_DIR, 'contracts', circuitName);

    fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.mkdirSync(JS_PATH, { recursive: true });
    fs.mkdirSync(PTAU_DIR, { recursive: true });
    fs.mkdirSync(CONTRACTS_DIR, { recursive: true });

    console.log(`\n--- Starting Evaluation for Circuit: ${circuitName} ---`);

    console.log('1. Compiling circuit...');
    const circomFilePath = path.join(CIRCUIT_DIR, `${circuitName}.circom`);
    if (!fs.existsSync(circomFilePath)) {
        console.error(`Error: Circuit file ${circomFilePath} not found. Exiting.`);
        results.metrics.compilation = { error: `Circuit file not found: ${circomFilePath}` };
        return results;
    }

    try {
        const compileResult = await runCommandAndMeasure(
            'circom',
            [circomFilePath, `--output`, `${BUILD_DIR}/`, `--r1cs`, `--wasm`, `--sym`, `-l`, `../node_modules`],
            { silent: true, captureOutput: true, monitorProcess: true }
        );

        results.metrics.compilation = {
            timeMs: compileResult.durationMs,
            maxMemoryBytes: compileResult.maxMemoryBytes,
            maxCpuPercent: compileResult.maxCpuPercent,
        };

        const circomOutput = compileResult.stdout + compileResult.stderr;
        const circuitDetails = {};
        circomOutput.split('\n').forEach(line => {
            const match = line.match(/(template instances|non-linear constraints|linear constraints|public inputs|private inputs|public outputs|wires|labels):\s*(\d+)\s*(.*)/);
            if (match) {
                let key = match[1].replace(/\s/g, '_').toLowerCase();
                if (key === 'private_inputs') {
                    const totalPrivate = parseInt(match[2]);
                    const witnessMatch = match[3].match(/\((\d+)\s+belong to witness\)/);
                    if (witnessMatch) {
                        circuitDetails['private_inputs_total'] = totalPrivate;
                        circuitDetails['private_inputs_witness'] = parseInt(witnessMatch[1]);
                    } else {
                        circuitDetails[key] = totalPrivate;
                    }
                } else {
                    circuitDetails[key] = parseInt(match[2]);
                }
            }
        });
        results.metrics.circuitDetails = circuitDetails;

        console.log(`   Compilation Time: ${results.metrics.compilation.timeMs.toFixed(2)} ms`);
        console.log(`   Circuit Details: ${JSON.stringify(circuitDetails, null, 2)}`);

    } catch (error) {
        console.error(`   Compilation failed: ${error.message}`);
        results.metrics.compilation = { error: error.message };
        return results;
    }

    console.log('\n2. Generating witness...');
    const witnessInputPath = path.join(CIRCUIT_DIR, `${circuitName}_input.json`);
    const witnessOutputPath = path.join(BUILD_DIR, 'witness.wtns');
    const wasmPath = path.join(JS_PATH, `${circuitName}.wasm`);

    if (!fs.existsSync(witnessInputPath)) {
        console.error(`   Error: Input file ${witnessInputPath} not found. Please create it.`);
        results.metrics.witnessGeneration = { error: `Input file not found: ${witnessInputPath}` };
        return results;
    }
    if (!fs.existsSync(wasmPath)) {
        console.error(`   Error: WASM file ${wasmPath} not found after compilation. Exiting.`);
        results.metrics.witnessGeneration = { error: `WASM file not found: ${wasmPath}` };
        return results;
    }

    try {
        const generateWitnessScriptPath = path.join(JS_PATH, 'generate_witness.js');
        if (!fs.existsSync(generateWitnessScriptPath)) {
             console.error(`   Error: generate_witness.js not found at ${generateWitnessScriptPath}. This file should be generated by circom.`);
             results.metrics.witnessGeneration = { error: `generate_witness.js missing.` };
             return results;
        }

        const witnessResult = await runCommandAndMeasure(
            'node',
            [generateWitnessScriptPath, wasmPath, witnessInputPath, witnessOutputPath],
            { monitorProcess: true }
        );
        results.metrics.witnessGeneration = {
            timeMs: witnessResult.durationMs,
            maxMemoryBytes: witnessResult.maxMemoryBytes,
            maxCpuPercent: witnessResult.maxCpuPercent,
            fileSizeWitnessBytes: fs.statSync(witnessOutputPath).size
        };
        console.log(`   Witness Generation Time: ${results.metrics.witnessGeneration.timeMs.toFixed(2)} ms`);
        console.log(`   Witness File Size: ${(results.metrics.witnessGeneration.fileSizeWitnessBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Witness Gen Max Memory: ${(results.metrics.witnessGeneration.maxMemoryBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Witness Gen Max CPU: ${results.metrics.witnessGeneration.maxCpuPercent.toFixed(2)} %`);


    } catch (error) {
        console.error(`   Witness generation failed: ${error.message}`);
        results.metrics.witnessGeneration = { error: error.message };
        return results;
    }

    console.log('\n3. Running trusted setup (Groth16 setup and ZKey contribution)...');
    const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
    const ptauFinalPath = path.join(PTAU_DIR, `pot${ptauLevel}_final.ptau`);
    const zkey0000Path = path.join(PTAU_DIR, `${circuitName}_0000.zkey`);
    const zkey0001Path = path.join(PTAU_DIR, `${circuitName}_0001.zkey`);
    const verificationKeyPath = path.join(BUILD_DIR, 'verification_key.json');

    if (!fs.existsSync(ptauFinalPath)) {
        console.error(`   Error: Powers of Tau final ptau file not found at ${ptauFinalPath}. Please generate it first.`);
        results.metrics.trustedSetup = { error: `PTAU file missing: ${ptauFinalPath}` };
        return results;
    }
    if (!fs.existsSync(r1csPath)) {
        console.error(`   Error: R1CS file not found at ${r1csPath}. Exiting.`);
        results.metrics.trustedSetup = { error: `R1CS file missing: ${r1csPath}` };
        return results;
    }

    try {
        console.log('   - Groth16 setup...');
        const setupResult = await runCommandAndMeasure(
            'snarkjs',
            ['groth16', 'setup', r1csPath, ptauFinalPath, zkey0000Path],
            { monitorProcess: true }
        );
        results.metrics.groth16Setup = {
            timeMs: setupResult.durationMs,
            maxMemoryBytes: setupResult.maxMemoryBytes,
            maxCpuPercent: setupResult.maxCpuPercent,
            fileSizeZkey0000Bytes: fs.statSync(zkey0000Path).size
        };
        console.log(`     Time: ${results.metrics.groth16Setup.timeMs.toFixed(2)} ms`);
        console.log(`     Initial Zkey (0000) size: ${(results.metrics.groth16Setup.fileSizeZkey0000Bytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`     Max Memory: ${(results.metrics.groth16Setup.maxMemoryBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`     Max CPU: ${results.metrics.groth16Setup.maxCpuPercent.toFixed(2)} %`);

        console.log('   - ZKey contribution...');
        const contributeResult = await runCommandAndMeasure(
            'snarkjs',
            ['zkey', 'contribute', zkey0000Path, zkey0001Path, '--name="Evaluation Script Contribution"', '-e="1234"'],
            { monitorProcess: true }
        );
        results.metrics.zkeyContribute = {
            timeMs: contributeResult.durationMs,
            maxMemoryBytes: contributeResult.maxMemoryBytes,
            maxCpuPercent: contributeResult.maxCpuPercent,
            fileSizeZkey0001Bytes: fs.statSync(zkey0001Path).size
        };
        console.log(`     Time: ${results.metrics.zkeyContribute.timeMs.toFixed(2)} ms`);
        console.log(`     Final Zkey (0001) size: ${(results.metrics.zkeyContribute.fileSizeZkey0001Bytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`     Max Memory: ${(results.metrics.zkeyContribute.maxMemoryBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`     Max CPU: ${results.metrics.zkeyContribute.maxCpuPercent.toFixed(2)} %`);

        console.log('   - Exporting verification key...');
        await runCommandAndMeasure('snarkjs', ['zkey', 'export', 'verificationkey', zkey0001Path, verificationKeyPath]);
        results.metrics.verificationKeyExport = {
            fileSizeVerificationKeyBytes: fs.statSync(verificationKeyPath).size
        };
        console.log(`     Verification Key size: ${(results.metrics.verificationKeyExport.fileSizeVerificationKeyBytes / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error(`   Trusted Setup/ZKey operations failed: ${error.message}`);
        results.metrics.trustedSetup = { error: error.message }; // Group errors here
        return results;
    }

    console.log('\n4. Generating proof...');
    const proofPath = path.join(BUILD_DIR, 'proof.json');
    const publicPath = path.join(BUILD_DIR, 'public.json');

    if (!fs.existsSync(zkey0001Path)) {
        console.error(`   Error: Zkey (0001) file not found at ${zkey0001Path}. Exiting.`);
        results.metrics.proofGeneration = { error: `Zkey (0001) missing: ${zkey0001Path}` };
        return results;
    }

    try {
        const proveResult = await runCommandAndMeasure(
            'snarkjs',
            ['groth16', 'prove', zkey0001Path, witnessOutputPath, proofPath, publicPath],
            { monitorProcess: true }
        );
        results.metrics.proofGeneration = {
            timeMs: proveResult.durationMs,
            maxMemoryBytes: proveResult.maxMemoryBytes,
            maxCpuPercent: proveResult.maxCpuPercent,
            fileSizeProofBytes: fs.statSync(proofPath).size,
            fileSizePublicInputsBytes: fs.statSync(publicPath).size
        };
        console.log(`   Proving Time: ${results.metrics.proofGeneration.timeMs.toFixed(2)} ms`);
        console.log(`   Proof Size: ${(results.metrics.proofGeneration.fileSizeProofBytes / 1024).toFixed(2)} KB`);
        console.log(`   Public Inputs Size: ${(results.metrics.proofGeneration.fileSizePublicInputsBytes / 1024).toFixed(2)} KB`);
        console.log(`   Proving Max Memory: ${(results.metrics.proofGeneration.maxMemoryBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Proving Max CPU: ${results.metrics.proofGeneration.maxCpuPercent.toFixed(2)} %`);

    } catch (error) {
        console.error(`   Proof generation failed: ${error.message}`);
        results.metrics.proofGeneration = { error: error.message };
        return results;
    }

    console.log('\n5. Verifying proof...');
    if (!fs.existsSync(verificationKeyPath)) {
        console.error(`   Error: Verification key file not found at ${verificationKeyPath}. Exiting.`);
        results.metrics.proofVerification = { error: `Verification key missing: ${verificationKeyPath}` };
        return results;
    }
    if (!fs.existsSync(publicPath)) {
        console.error(`   Error: Public inputs file not found at ${publicPath}. Exiting.`);
        results.metrics.proofVerification = { error: `Public inputs file missing: ${publicPath}` };
        return results;
    }
    if (!fs.existsSync(proofPath)) {
        console.error(`   Error: Proof file not found at ${proofPath}. Exiting.`);
        results.metrics.proofVerification = { error: `Proof file missing: ${proofPath}` };
        return results;
    }

    try {
        const verifyResult = await runCommandAndMeasure(
            'snarkjs',
            ['groth16', 'verify', verificationKeyPath, publicPath, proofPath],
            { monitorProcess: true }
        );
        results.metrics.proofVerification = {
            timeMs: verifyResult.durationMs,
            maxMemoryBytes: verifyResult.maxMemoryBytes,
            maxCpuPercent: verifyResult.maxCpuPercent,
        };
        console.log(`   Verification Time: ${results.metrics.proofVerification.timeMs.toFixed(2)} ms`);
        console.log(`   Verification Max Memory: ${(results.metrics.proofVerification.maxMemoryBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Verification Max CPU: ${results.metrics.proofVerification.maxCpuPercent.toFixed(2)} %`);

    } catch (error) {
        console.error(`   Proof verification failed: ${error.message}`);
        results.metrics.proofVerification = { error: error.message };
        return results;
    }

    console.log('\n6. Exporting Solidity verifier...');
    const solidityVerifierPath = path.join(CONTRACTS_DIR, 'verifier.sol');
    try {
        await runCommandAndMeasure('snarkjs', ['zkey', 'export', 'solidityverifier', zkey0001Path, solidityVerifierPath]);
        results.metrics.solidityVerifierExport = {
            fileSizeSolidityVerifierBytes: fs.statSync(solidityVerifierPath).size
        };
        console.log(`   Solidity Verifier Size: ${(results.metrics.solidityVerifierExport.fileSizeSolidityVerifierBytes / 1024).toFixed(2)} KB`);
    } catch (error) {
        console.error(`   Solidity verifier export failed: ${error.message}`);
        results.metrics.solidityVerifierExport = { error: error.message };
    }

    console.log(`\n--- Evaluation for ${circuitName} Completed ---`);
    return results;
}

async function main() {
    const circuitName = process.argv[2];
    if (!circuitName) {
        console.error("Usage: node evaluate.js <CIRCUIT_NAME>");
        process.exit(1);
    }
    try {
        require.resolve('pidusage');
    } catch (e) {
        console.error("Error: 'pidusage' package not found. Please install it: npm install pidusage");
        process.exit(1);
    }
    const evaluationResults = await evaluateCircuit(circuitName);
    const outputFileName = `metrics_${circuitName}_${Date.now()}.json`;
    fs.writeFileSync(outputFileName, JSON.stringify(evaluationResults, null, 2));
    console.log(`\nAll metrics saved to ${outputFileName}`);
    console.log("------------------------------------------");
}

main();