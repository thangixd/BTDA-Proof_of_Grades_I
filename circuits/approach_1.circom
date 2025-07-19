pragma circom 2.1.5;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/comparators.circom";

template TranscriptVerifier(maxCourses) {
    signal input courseIds[maxCourses];
    signal input grades[maxCourses];
    signal input signaturesR8x[maxCourses];
    signal input signaturesR8y[maxCourses];
    signal input signaturesS[maxCourses];
    signal input userSecret;

    signal input transcriptCommitment;

    signal output nullifierHash;

    var issuerPubKeyX = 8007534525180419320176005557667530307145687619921362857565374267454418082344;
    var issuerPubKeyY = 6683455268269313456735416429951639487199038602967063000322875192641406052668;
    var REQUIRED_COURSES = 2;
    var REQUIRED_COURSE_IDS[REQUIRED_COURSES] = [101, 104];

    component courseHashers[maxCourses];
    component sigVerifiers[maxCourses];
    component isDummy[maxCourses];
    component commitmentHasher = Poseidon(1 + (maxCourses * 5));
    component isPassing[maxCourses];
    component nullifierHasher = Poseidon(1 + REQUIRED_COURSES * 2);

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

   // assert that first ids are the required ones
    courseIds[0] === REQUIRED_COURSE_IDS[0];
    courseIds[1] === REQUIRED_COURSE_IDS[1];

    // assert that the first two courses have the required grades
    component gradeCheck[REQUIRED_COURSES];
    for (var i = 0; i < REQUIRED_COURSES; i++) {
        gradeCheck[i] = LessEqThan(6);
        gradeCheck[i].in[0] <== grades[i];
        gradeCheck[i].in[1] <== 40; 
        gradeCheck[i].out === 1;
    }
    // create nullifier hash form courses used in the proof
    nullifierHasher.inputs[0] <== userSecret;
    for (var i = 0; i < REQUIRED_COURSES; i++) {
        nullifierHasher.inputs[1 + i*2] <== courseIds[i];
        nullifierHasher.inputs[1 + i*2 + 1] <== grades[i];
    }
    nullifierHash <== nullifierHasher.out;
}

component main {public [transcriptCommitment]} = TranscriptVerifier(3);