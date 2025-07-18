// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract GaslessNFT is ERC721, ERC2771Context, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;
    string private _baseTokenURI;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId);
    event NFTTransferred(address indexed from, address indexed to, uint256 indexed tokenId);
    event ETHSent(address indexed sender, uint256 amount);
    
    constructor(address trustedForwarder, string memory baseURI) 
        ERC721("GaslessNFT", "GNFT") 
        ERC2771Context(trustedForwarder) 
        Ownable(_msgSender()) 
    {
        _baseTokenURI = baseURI;
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    function mint(address to) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit NFTMinted(to, tokenId);
        return tokenId;
    }

    function sendETH() public payable {
        require(msg.value > 0, "GaslessNFT: No ETH sent");
        (bool success, ) = address(this).call{value: msg.value}("");
        require(success, "GaslessNFT: Failed to send ETH");
        emit ETHSent(_msgSender(), msg.value);
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function safeMint(address to) public returns (uint256) {
        return mint(to);
    }

    // Custom transfer function that emits events
    function customTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
        emit NFTTransferred(from, to, tokenId);
    }

    // Gasless approve function
    function gaslessApprove(address to, uint256 tokenId) public {
        address sender = _msgSender();
        require(_isApprovedOrOwner(sender, tokenId), "GaslessNFT: approve caller is not owner nor approved");
        _approve(to, tokenId, sender);
    }

    // Gasless transfer function
    function gaslessTransfer(address to, uint256 tokenId) public {
        address sender = _msgSender();
        require(_isApprovedOrOwner(sender, tokenId), "GaslessNFT: transfer caller is not owner nor approved");
        
        address from = ownerOf(tokenId);
        _transfer(from, to, tokenId);
        emit NFTTransferred(from, to, tokenId);
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return bytes(_baseTokenURI).length > 0 
            ? string(abi.encodePacked(_baseTokenURI, tokenId.toString())) 
            : "";
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }

    // Helper function to check if address is approved or owner
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
} 