// ignition/modules/AcademicAwardModule.ts

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AcademicAwardModule = buildModule("AcademicAwardModule", (m) => {
  // Step 1: Deploy the Verifier contract.
  // The contract name "Groth16Verifier" must match the name inside your Verifier.sol file.
  const verifier = m.contract("Groth16Verifier");

  // Step 2: Deploy the AcademicAward contract.
  // - Pass the 'verifier' future object directly into the args array.
  // - Set the deployer using m.getAccount() in the 'from' option.
  const academicAward = m.contract("AcademicAward", [verifier], {
    from: m.getAccount(0),
  });

  // Return the deployed contract instances.
  return { verifier, academicAward };
});

export default AcademicAwardModule;