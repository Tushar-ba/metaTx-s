// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title MinimalGaslessExample
 * @dev This shows the MINIMUM required changes to make any contract gasless
 * 
 * ONLY 3 THINGS NEEDED:
 * 1. Inherit ERC2771Context
 * 2. Pass trustedForwarder to constructor
 * 3. Override _msgSender() (and related context functions)
 * 
 * ALL existing functions automatically become gasless!
 */
contract MinimalGaslessExample is ERC721, ERC2771Context {
    uint256 private _nextTokenId;
    
    // NECESSARY: Constructor with trusted forwarder
    constructor(address trustedForwarder) 
        ERC721("MinimalGasless", "MGL") 
        ERC2771Context(trustedForwarder) 
    {}

    // NECESSARY: Override context functions
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    // THAT'S IT! All these functions now work gaslessly:
    
    function mint(address to) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
    
    // Standard ERC721 functions automatically work gaslessly:
    // - approve(address to, uint256 tokenId) 
    // - transferFrom(address from, address to, uint256 tokenId)
    // - safeTransferFrom(...)
    // - setApprovalForAll(...)
    // 
    // NO ADDITIONAL "gasless" versions needed!
} 