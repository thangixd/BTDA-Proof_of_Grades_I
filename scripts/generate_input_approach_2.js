const fs = require('fs');
const crypto = require('crypto');
const { buildPoseidon } = require('circomlibjs');
const { buildEddsa } = require('circomlibjs');

const TREE_LEVELS = 2;
const MAX_COURSES = 2 ** TREE_LEVELS;

async function main() {
    const poseidon = await buildPoseidon();
    const eddsa = await buildEddsa();
    const F = poseidon.F;

    function hashCourse(course) {
        const hash = poseidon([course.courseId, course.grade]);
        return F.toObject(hash);
    }
    const poseidonHash = (a, b) => {
        const hash = poseidon([a, b]);
        return F.toObject(hash);
    };

    const issuerPrvKey = "21804887531809213748216301634131713998330740339618128104492916234109253833710";
    const userSecret = F.toObject(crypto.randomBytes(32));
    
    const transcript = [
        { courseId: 101, grade: 25 }, 
        { courseId: 102, grade: 15 },
        { courseId: 105, grade: 15 },
        { courseId: 202, grade: 45 },
    ];

    const paddedTranscript = [...transcript];
    while (paddedTranscript.length < MAX_COURSES) {
        paddedTranscript.push({ courseId: 0, grade: 0 });
    }

    const leaves = paddedTranscript.map(c => hashCourse(c));

    function buildMerkleTree(leaves) {
        const tree = [leaves];
        
        for (let level = 0; level < TREE_LEVELS; level++) {
            const currentLevel = tree[level];
            const nextLevel = [];
            
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = currentLevel[i + 1];
                const hash = poseidonHash(left, right);
                nextLevel.push(hash);
            }
            tree.push(nextLevel);
        }
        return tree[TREE_LEVELS][0];
    }
    
    const root = buildMerkleTree(leaves);
    const rootSignature = eddsa.signPoseidon(issuerPrvKey, F.e(root));
    const courseIds = paddedTranscript.map(c => c.courseId);
    const grades = paddedTranscript.map(c => c.grade);

    let commitment = poseidon([userSecret]);
    commitment = poseidon([F.toObject(commitment), root]);
    
    const transcriptCommitment = F.toObject(commitment);

    const inputs = {
        courseIds: courseIds.map(String),
        grades: grades.map(String),
        userSecret: String(userSecret),
        merkleRoot: root.toString(),
        rootSignatureR8x: F.toObject(rootSignature.R8[0]).toString(),
        rootSignatureR8y: F.toObject(rootSignature.R8[1]).toString(),
        rootSignatureS: rootSignature.S.toString(),
        transcriptCommitment: transcriptCommitment.toString()
    };

    fs.writeFileSync('./circuits/approach_2_input.json', JSON.stringify(inputs, null, 2));
    console.log("Successfully generated final, compatible approach_2_input.json in './circuits/ .");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});