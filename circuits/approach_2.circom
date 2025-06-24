pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";

template Approach2TranscriptProof() {
    var TREE_LEVELS = 2;
    var MAX_COURSES = 4;
    var REQUIRED_COURSES = 2;
    var REQUIRED_COURSE_IDS[REQUIRED_COURSES] = [101,102];

    signal input transcriptCommitment;

    signal input courseIds[MAX_COURSES];
    signal input grades[MAX_COURSES];
    signal input userSecret;
    signal input merkleRoot;
    signal input rootSignatureR8x;
    signal input rootSignatureR8y;
    signal input rootSignatureS;

    signal output nullifierHash;

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


    component leafs[MAX_COURSES];
    for (var i = 0; i < MAX_COURSES; i++) {
        leafs[i] = Poseidon(2);
        leafs[i].inputs[0] <== courseIds[i];
        leafs[i].inputs[1] <== grades[i];
    }
    component inner_nodes[MAX_COURSES / 2];
    for (var i = 0; i < MAX_COURSES / 2; i++) {
        inner_nodes[i] = Poseidon(2);
        inner_nodes[i].inputs[0] <== leafs[i * 2].out;
        inner_nodes[i].inputs[1] <== leafs[i * 2 + 1].out;
    }
    component root = Poseidon(2);
    root.inputs[0] <== inner_nodes[0].out;
    root.inputs[1] <== inner_nodes[1].out;

    component signatureVerifier = EdDSAPoseidonVerifier();
    signatureVerifier.enabled <== 1;
    signatureVerifier.Ax <== 8007534525180419320176005557667530307145687619921362857565374267454418082344;
    signatureVerifier.Ay <== 6683455268269313456735416429951639487199038602967063000322875192641406052668;
    signatureVerifier.R8x <== rootSignatureR8x;
    signatureVerifier.R8y <== rootSignatureR8y;
    signatureVerifier.S <== rootSignatureS;
    signatureVerifier.M <== root.out;

    component initialHasher = Poseidon(1);
    initialHasher.inputs[0] <== userSecret;
    
    component commitmentHashers[2];
    
    commitmentHashers[0] = Poseidon(2);
    commitmentHashers[0].inputs[0] <== initialHasher.out;
    commitmentHashers[0].inputs[1] <== merkleRoot;

    transcriptCommitment === commitmentHashers[0].out;

    component nullifierHasher = Poseidon(1 + REQUIRED_COURSES * 2);
    nullifierHasher.inputs[0] <== userSecret;
    for (var i = 0; i < REQUIRED_COURSES; i++) {
        nullifierHasher.inputs[1 + i*2]     <== courseIds[i];
        nullifierHasher.inputs[1 + i*2 + 1] <== grades[i];
    }
    nullifierHash <== nullifierHasher.out;
}



component main {public [transcriptCommitment]} = Approach2TranscriptProof();