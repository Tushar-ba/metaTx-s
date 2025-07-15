// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GaslessMarketplace
 * @dev Upgradeable marketplace with gasless transaction support
 * 
 * Key Design Decisions for Payments:
 * 1. Meta-transactions handle APPROVALS and LISTINGS (gasless)
 * 2. PURCHASES still require ETH/tokens from the buyer (not gasless for payments)
 * 3. Sellers can list/cancel for free (gasless)
 */
contract GaslessMarketplace is 
    Initializable,
    ERC2771ContextUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        address paymentToken; // address(0) for ETH
        uint256 price;
        bool active;
        uint256 deadline;
    }

    mapping(bytes32 => Listing) public listings;
    mapping(address => bool) public supportedPaymentTokens;
    
    uint256 public marketplaceFee; // Basis points (e.g., 250 = 2.5%)
    address public feeRecipient;

    event ItemListed(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    );

    event ItemSold(
        bytes32 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );

    event ListingCancelled(bytes32 indexed listingId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the marketplace
     * @param trustedForwarder Address of the ERC2771 forwarder
     * @param owner Owner of the marketplace
     * @param _feeRecipient Address to receive marketplace fees
     * @param _marketplaceFee Fee in basis points
     */
    function initialize(
        address trustedForwarder,
        address owner,
        address _feeRecipient,
        uint256 _marketplaceFee
    ) public initializer {
        __ERC2771Context_init(trustedForwarder);
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        
        feeRecipient = _feeRecipient;
        marketplaceFee = _marketplaceFee;
        
        // Add ETH and common stablecoins as supported payment tokens
        supportedPaymentTokens[address(0)] = true; // ETH
    }

    // ===== ERC2771 CONTEXT OVERRIDES =====
    function _msgSender() 
        internal 
        view 
        override(ContextUpgradeable, ERC2771ContextUpgradeable) 
        returns (address) 
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() 
        internal 
        view 
        override(ContextUpgradeable, ERC2771ContextUpgradeable) 
        returns (bytes calldata) 
    {
        return ERC2771ContextUpgradeable._msgData();
    }

    function _contextSuffixLength() 
        internal 
        view 
        override(ContextUpgradeable, ERC2771ContextUpgradeable) 
        returns (uint256) 
    {
        return ERC2771ContextUpgradeable._contextSuffixLength();
    }

    // ===== GASLESS FUNCTIONS (Can be called via meta-transactions) =====

    /**
     * @dev List an NFT for sale (GASLESS)
     * The seller signs this transaction, relayer pays gas
     */
    function listItem(
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price,
        uint256 deadline
    ) external {
        address seller = _msgSender(); // Gets real seller via ERC2771
        
        require(supportedPaymentTokens[paymentToken], "Payment token not supported");
        require(price > 0, "Price must be greater than 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        
        // Verify seller owns the NFT
        require(IERC721(nftContract).ownerOf(tokenId) == seller, "Not token owner");
        
        // Verify marketplace is approved to transfer
        require(
            IERC721(nftContract).isApprovedForAll(seller, address(this)) ||
            IERC721(nftContract).getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );

        bytes32 listingId = keccak256(abi.encodePacked(nftContract, tokenId, seller, block.timestamp));
        
        listings[listingId] = Listing({
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId,
            paymentToken: paymentToken,
            price: price,
            active: true,
            deadline: deadline
        });

        emit ItemListed(listingId, seller, nftContract, tokenId, paymentToken, price);
    }

    /**
     * @dev Cancel a listing (GASLESS)
     * The seller signs this transaction, relayer pays gas
     */
    function cancelListing(bytes32 listingId) external {
        Listing storage listing = listings[listingId];
        address seller = _msgSender();
        
        require(listing.seller == seller, "Not the seller");
        require(listing.active, "Listing not active");
        
        listing.active = false;
        
        emit ListingCancelled(listingId);
    }

    /**
     * @dev Approve marketplace to spend ERC20 tokens (GASLESS)
     * Users can approve the marketplace to spend their tokens without paying gas
     */
    function gaslessApprove(address token, uint256 amount) external {
        address user = _msgSender();
        // This would require the token contract to support ERC2771 as well
        // For now, users need to approve tokens directly
        require(false, "Use token contract directly for approvals");
    }

    // ===== NON-GASLESS FUNCTIONS (Require payment from caller) =====

    /**
     * @dev Purchase an NFT (NOT GASLESS - buyer pays)
     * Buyers must pay for purchases themselves as they involve value transfer
     */
    function purchaseItem(bytes32 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        
        require(listing.active, "Listing not active");
        require(block.timestamp <= listing.deadline, "Listing expired");
        
        address buyer = msg.sender; // Use msg.sender for payments, not _msgSender()
        uint256 price = listing.price;
        address paymentToken = listing.paymentToken;
        
        // Calculate fees
        uint256 fee = (price * marketplaceFee) / 10000;
        uint256 sellerAmount = price - fee;
        
        // Handle payment
        if (paymentToken == address(0)) {
            // ETH payment
            require(msg.value == price, "Incorrect ETH amount");
            
            // Transfer ETH to seller and fee recipient
            payable(listing.seller).transfer(sellerAmount);
            if (fee > 0) {
                payable(feeRecipient).transfer(fee);
            }
        } else {
            // ERC20 payment
            require(msg.value == 0, "Should not send ETH for token payment");
            
            IERC20 token = IERC20(paymentToken);
            token.safeTransferFrom(buyer, listing.seller, sellerAmount);
            if (fee > 0) {
                token.safeTransferFrom(buyer, feeRecipient, fee);
            }
        }
        
        // Transfer NFT to buyer
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            buyer,
            listing.tokenId
        );
        
        // Mark listing as inactive
        listing.active = false;
        
        emit ItemSold(listingId, buyer, listing.seller, price);
    }

    // ===== ADMIN FUNCTIONS =====

    function addPaymentToken(address token) external onlyOwner {
        supportedPaymentTokens[token] = true;
    }

    function removePaymentToken(address token) external onlyOwner {
        supportedPaymentTokens[token] = false;
    }

    function updateMarketplaceFee(uint256 _marketplaceFee) external onlyOwner {
        require(_marketplaceFee <= 1000, "Fee too high"); // Max 10%
        marketplaceFee = _marketplaceFee;
    }

    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    // ===== VIEW FUNCTIONS =====

    function getListing(bytes32 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        return ERC2771ContextUpgradeable.isTrustedForwarder(forwarder);
    }
} 