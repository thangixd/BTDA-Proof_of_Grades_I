pragma circom 2.1.5;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

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
    signal input courseIds[maxCourses];
    signal input grades[maxCourses];
    signal input signaturesR8x[maxCourses];
    signal input signaturesR8y[maxCourses];
    signal input signaturesS[maxCourses];
    signal input userSecret;

    signal input transcriptCommitment;

    signal output nullifierHash;

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
    
    component isCourseMatch[maxCourses * numRequired];
    component courseCheckSummer[numRequired];

    for (var k = 0; k < maxCourses * numRequired; k++) {
        isCourseMatch[k] = IsEqual();
    }
    for (var j = 0; j < numRequired; j++) {
        courseCheckSummer[j] = Sum(maxCourses);
    }

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
    for (var i = 0; i < maxCourses; i++) {
        isPassing[i] = LessThan(6);
        isPassing[i].in[0] <== grades[i];
        isPassing[i].in[1] <== 40;
    }
    for (var j = 0; j < numRequired; j++) {
        for (var i = 0; i < maxCourses; i++) {
            var k = j * maxCourses + i;
            isCourseMatch[k].in[0] <== courseIds[i];
            isCourseMatch[k].in[1] <== requiredCourseIds[j];
            var isRequirementMet = isCourseMatch[k].out * isPassing[i].out;
            courseCheckSummer[j].in[i] <== isRequirementMet;
        }
        courseCheckSummer[j].out === 1;
    }
    nullifierHasher.inputs[0] <== userSecret;
    nullifierHasher.inputs[1] <== transcriptCommitment;
    nullifierHash <== nullifierHasher.out;
}

component main {public [transcriptCommitment]} = TranscriptVerifier(3);