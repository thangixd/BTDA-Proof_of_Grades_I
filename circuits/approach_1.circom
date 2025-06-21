pragma circom 2.1.5;

/* circom circuits/TranscriptVerifier.circom --r1cs --wasm --sym -o circuits/build -l node_modules */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Helper component to sum up an array of signals correctly.
template Sum(n) {
    signal input in[n];
    signal output out;

    var lc = 0;
    for (var i = 0; i < n; i++) {
        lc += in[i];
    }
    out <== lc;
}

template TranscriptVerifier(maxCourses) {
    // === INPUTS ===
    signal input courseIds[maxCourses];
    signal input grades[maxCourses];
    signal input signaturesR8x[maxCourses];
    signal input signaturesR8y[maxCourses];
    signal input signaturesS[maxCourses];
    signal input userSecret;

    // --- Public Inputs ---
    signal input transcriptCommitment;

    // === OUTPUTS ===
    signal output nullifierHash;

    // === COMPONENT DECLARATIONS ===
    component courseHashers[maxCourses];
    component sigVerifiers[maxCourses];
    component isDummy[maxCourses];
    component commitmentHasher = Poseidon(1 + (maxCourses * 5));
    component nullifierHasher = Poseidon(2);
    component isPassing[maxCourses];
    var issuerPubKeyX = 8007534525180419320176005557667530307145687619921362857565374267454418082344;
    var issuerPubKeyY = 6683455268269313456735416429951639487199038602967063000322875192641406052668;
    var numRequired = 2;
    var requiredCourseIds[numRequired] = [101, 104];
    
    // FIX 1: Declare component arrays for course matching and summing.
    // We need one IsEqual for each course-requirement pair.
    component isCourseMatch[maxCourses * numRequired];
    // We need one Sum for each required course.
    component courseCheckSummer[numRequired];

    // FIX 2: Instantiate each component in the arrays using loops.
    for (var k = 0; k < maxCourses * numRequired; k++) {
        isCourseMatch[k] = IsEqual();
    }
    for (var j = 0; j < numRequired; j++) {
        courseCheckSummer[j] = Sum(maxCourses);
    }

    // --- MODULE 1: SIGNATURE AND TRANSCRIPT INTEGRITY VERIFICATION ---
    commitmentHasher.inputs[0] <== userSecret;

    for (var i = 0; i < maxCourses; i++) {
        courseHashers[i] = Poseidon(2);
        courseHashers[i].inputs[0] <== courseIds[i];
        courseHashers[i].inputs[1] <== grades[i];

        isDummy[i] = IsZero();
        isDummy[i].in <== courseIds[i];

        sigVerifiers[i] = EdDSAPoseidonVerifier();
        sigVerifiers[i].enabled <== 1 - isDummy[i].out;
        sigVerifiers[i].Ax <== issuerPubKeyX;
        sigVerifiers[i].Ay <== issuerPubKeyY;
        sigVerifiers[i].R8x <== signaturesR8x[i];
        sigVerifiers[i].R8y <== signaturesR8y[i];
        sigVerifiers[i].S <== signaturesS[i];
        sigVerifiers[i].M <== courseHashers[i].out;
        
        var base_idx = 1 + i * 5;
        commitmentHasher.inputs[base_idx] <== courseIds[i];
        commitmentHasher.inputs[base_idx+1] <== grades[i];
        commitmentHasher.inputs[base_idx+2] <== signaturesR8x[i];
        commitmentHasher.inputs[base_idx+3] <== signaturesR8y[i];
        commitmentHasher.inputs[base_idx+4] <== signaturesS[i];
    }

    commitmentHasher.out === transcriptCommitment;

    // --- MODULE 2: COURSE AND GRADE REQUIREMENT VERIFICATION ---
    // 1. Pre-calculate which of the student's courses have a passing grade.
    for (var i = 0; i < maxCourses; i++) {
        isPassing[i] = LessThan(6); // Using 6 signal bits for the grade
        isPassing[i].in[0] <== grades[i];
        isPassing[i].in[1] <== 40; // The passing threshold
    }

    // 2. For each required course, ensure there is exactly one match
    // from the set of courses that have a passing grade.
    for (var j = 0; j < numRequired; j++) {
        for (var i = 0; i < maxCourses; i++) {
            // FIX 3: Calculate a unique index for the flattened isCourseMatch array.
            var k = j * maxCourses + i;

            // Use the pre-declared component instance.
            isCourseMatch[k].in[0] <== courseIds[i];
            isCourseMatch[k].in[1] <== requiredCourseIds[j];
            
            // A course requirement is met if the ID matches AND the grade was pre-validated as passing.
            var isRequirementMet = isCourseMatch[k].out * isPassing[i].out;
            
            // Feed this result into the correct summer component for the j-th required course.
            courseCheckSummer[j].in[i] <== isRequirementMet;
        }
        
        // Assert that each required course was met exactly once.
        courseCheckSummer[j].out === 1;
    }

    // --- MODULE 3: NULLIFIER GENERATION ---
    nullifierHasher.inputs[0] <== userSecret;
    log(nullifierHasher.inputs[0]);
    nullifierHasher.inputs[1] <== transcriptCommitment;
    log(nullifierHasher.inputs[1]);
    
    nullifierHash <== nullifierHasher.out;
    log(nullifierHash);
}

// --- MAIN COMPONENT INSTANTIATION ---
component main {public [transcriptCommitment]} = TranscriptVerifier(3);