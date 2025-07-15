// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Use the production-ready forwarder from OpenZeppelin 5.x
import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @title ProductionForwarder
 * @dev Production-ready forwarder using OpenZeppelin 5.x
 * 
 * This is the RECOMMENDED approach for production deployments.
 * 
 * Features included:
 * ✅ Nonce management with Nonces.sol
 * ✅ Deadline protection (requests expire)
 * ✅ Batch execution support
 * ✅ Trust validation
 * ✅ Gas optimizations
 * ✅ Security audited
 */
contract ProductionForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("ProductionForwarder") {}
    
    // That's it! The ERC2771Forwarder has everything you need:
    // - execute(ForwardRequestData request)
    // - executeBatch(ForwardRequestData[] requests, address payable refundReceiver)
    // - verify(ForwardRequestData request) 
    // - nonces(address owner)
    // 
    // Plus built-in security features:
    // - Deadline validation
    // - Signature verification
    // - Target trust validation
    // - Nonce management
} 