const fs = require('fs');
const { buildPoseidon } = require('circomlibjs');
const { buildEddsa } = require('circomlibjs');
const crypto = require('crypto');

// Circuit parameters (must match the.circom file)
const MAX_COURSES = 3;

async function main() {
    console.log("Generating inputs for the circuit...");

    const poseidon = await buildPoseidon();
    const eddsa = await buildEddsa();
    const F = poseidon.F;

    const issuerPrvKey = "21804887531809213748216301634131713998330740339618128104492916234109253833710";

    const userSecret = F.toObject(crypto.randomBytes(32));
    const transcript = [
        { courseId: 101, grade: 25 },
        { courseId: 104, grade: 15 },
        { courseId: 105, grade: 15 },
    ];
    // const issuerPubKey = eddsa.prv2pub(issuerPrvKey);
    const signatures = transcript.map(course => {
        const msgHash = poseidon([course.courseId, course.grade]);
        return eddsa.signPoseidon(issuerPrvKey, msgHash);
    });

    const courseIds = new Array(MAX_COURSES).fill(0);
    const grades = new Array(MAX_COURSES).fill(0);
    const signaturesR8x = new Array(MAX_COURSES).fill(0);
    const signaturesR8y = new Array(MAX_COURSES).fill(0);
    const signaturesS = new Array(MAX_COURSES).fill(0);

    for (let i = 0; i < transcript.length; i++) {
        courseIds[i] = transcript[i].courseId;
        grades[i] = transcript[i].grade;
        signaturesR8x[i] = F.toObject(signatures[i].R8[0]);
        signaturesR8y[i] = F.toObject(signatures[i].R8[1]);
        signaturesS[i] = signatures[i].S;
    }
    
    const commitmentInputs =[userSecret];
    for (let i = 0; i < MAX_COURSES; i++) {
        commitmentInputs.push(courseIds[i]);
        commitmentInputs.push(grades[i]);
        commitmentInputs.push(signaturesR8x[i]);
        commitmentInputs.push(signaturesR8y[i]);
        commitmentInputs.push(signaturesS[i]);
    }
    
    const transcriptCommitment = F.toObject(poseidon(commitmentInputs));

    const inputs = {
        courseIds: courseIds.map(String),
        grades: grades.map(String),
        signaturesR8x: signaturesR8x.map(String),
        signaturesR8y: signaturesR8y.map(String),
        signaturesS: signaturesS.map(String),
        userSecret: String(userSecret),

        transcriptCommitment: String(transcriptCommitment),
    };

    fs.writeFileSync('./circuits/approach_1_input.json', JSON.stringify(inputs, null, 2));
    console.log("Successfully generated approach_1_input.json in./circuits/");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});