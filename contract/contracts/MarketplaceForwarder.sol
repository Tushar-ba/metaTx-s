// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title MarketplaceForwarder
 * @dev Upgradeable ERC2771 forwarder for marketplace gasless transactions
 */
contract MarketplaceForwarder is ERC2771ForwarderUpgradeable, OwnableUpgradeable {
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the forwarder
     * @param name The name for EIP-712 domain (e.g., "MarketplaceForwarder")
     * @param owner The owner of the forwarder contract
     */
    function initialize(string memory name, address owner) public initializer {
        __ERC2771Forwarder_init(name);
        __Ownable_init(owner);
    }

    /**
     * @dev Override to add owner-only restriction if needed
     * Can restrict who can call the forwarder for additional security
     */
    function execute(ForwardRequestData calldata request) 
        public 
        payable 
        override 
    {
        // Add any additional validation here if needed
        // For now, allow anyone to relay (standard behavior)
        super.execute(request);
    }

    /**
     * @dev Override batch execution with owner controls if needed
     */
    function executeBatch(
        ForwardRequestData[] calldata requests,
        address payable refundReceiver
    ) public payable override {
        super.executeBatch(requests, refundReceiver);
    }

    /**
     * @dev Emergency function to pause the forwarder if needed
     * Only owner can call this
     */
    function pause() external onlyOwner {
        // Implement pause logic if needed
        // This is a safety mechanism for emergencies
    }
} 