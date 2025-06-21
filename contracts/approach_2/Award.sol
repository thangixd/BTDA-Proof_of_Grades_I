// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./verifier.sol";
import "hardhat/console.sol";

contract AcademicAward is ERC721, Ownable {
    Groth16Verifier public immutable verifier;
    mapping(uint256 => bool) public nullifiers;

    event AwardMinted(
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 nullifier
    );

    error InvalidProof();
    error ProofAlreadyUsed();

    constructor(
        address verifierAddress
    ) ERC721("Academic Achievement Award", "AAA") Ownable(msg.sender) {
        verifier = Groth16Verifier(verifierAddress);
    }

    function awardNFT(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[2] memory publicInputs
    ) public {
        uint256 nullifier = publicInputs[0];

        if (nullifiers[nullifier]) {
            revert ProofAlreadyUsed();
        }
        if (!verifier.verifyProof(a, b, c, publicInputs)) {
            revert InvalidProof();
        }

        nullifiers[nullifier] = true;
        _safeMint(msg.sender, nullifier);

        emit AwardMinted(msg.sender, nullifier, nullifier);
    }
}