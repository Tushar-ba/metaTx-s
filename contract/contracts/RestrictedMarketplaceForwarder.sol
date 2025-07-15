// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title RestrictedMarketplaceForwarder
 * @dev ERC2771 forwarder with relayer access control
 * 
 * This version restricts who can relay transactions,
 * similar to your current MinimalForwarder approach.
 */
contract RestrictedMarketplaceForwarder is ERC2771ForwarderUpgradeable, OwnableUpgradeable {
    
    // Relayer management
    mapping(address => bool) public authorizedRelayers;
    
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    
    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "Not an authorized relayer");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the forwarder
     * @param name The name for EIP-712 domain
     * @param owner The owner of the forwarder contract
     * @param initialRelayer The first authorized relayer
     */
    function initialize(
        string memory name, 
        address owner,
        address initialRelayer
    ) public initializer {
        __ERC2771Forwarder_init(name);
        __Ownable_init(owner);
        
        // Set initial relayer
        authorizedRelayers[initialRelayer] = true;
        emit RelayerAdded(initialRelayer);
    }

    /**
     * @dev Override execute to add relayer restriction
     */
    function execute(ForwardRequestData calldata request) 
        public 
        payable 
        override 
        onlyAuthorizedRelayer 
    {
        super.execute(request);
    }

    /**
     * @dev Override batch execution with relayer restriction
     */
    function executeBatch(
        ForwardRequestData[] calldata requests,
        address payable refundReceiver
    ) public payable override onlyAuthorizedRelayer {
        super.executeBatch(requests, refundReceiver);
    }

    // ===== RELAYER MANAGEMENT =====

    /**
     * @dev Add an authorized relayer
     */
    function addRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "Invalid relayer address");
        require(!authorizedRelayers[relayer], "Relayer already authorized");
        
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    /**
     * @dev Remove an authorized relayer
     */
    function removeRelayer(address relayer) external onlyOwner {
        require(authorizedRelayers[relayer], "Relayer not authorized");
        
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    /**
     * @dev Check if an address is an authorized relayer
     */
    function isAuthorizedRelayer(address relayer) external view returns (bool) {
        return authorizedRelayers[relayer];
    }

    /**
     * @dev Get all relayer-related info for frontend
     */
    function getRelayerInfo(address relayer) external view returns (
        bool isAuthorized,
        address owner,
        uint256 nonce
    ) {
        return (
            authorizedRelayers[relayer],
            owner(),
            nonces(relayer)
        );
    }
} 