// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ProofRegistry
/// @notice Anchors citizen-submitted field proofs and the corroborations they receive.
/// @dev Design constraints that shaped this contract:
///
///      1. Submitters have a keypair, not a wallet. Field users cannot fund gas, so a
///         backend relayer signs every transaction. `msg.sender` is therefore never the
///         author of a proof and carries no authorization meaning beyond "the relayer
///         accepted this". Identity is expressed by `deviceKeyHash`, the keccak256 of the
///         WebCrypto public key that signed the bundle off-chain.
///
///      2. Nothing that could identify a person is stored. Photos never reach the chain,
///         only their hash. Location is a 5-character geohash (~5km cell), never exact
///         coordinates.
///
///      3. Scoring is deliberately off-chain. Corroboration weights, collusion penalties
///         and density-scaled thresholds are policy, and policy changes faster than a
///         deployed contract should. This contract stores only facts: who acted, when,
///         from which cell, and under which verifier. Clients derive confidence from the
///         attestation records and can disagree about the formula without forking data.
///
///      4. Nothing is ever deleted. A contested proof gains a dispute counter; it does
///         not disappear. Removal would make the registry as deniable as the reports it
///         replaces.
contract ProofRegistry {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotRelayer();
    error ZeroAddress();
    error ProofNotFound();
    error AlreadyActed();
    error SelfAction();
    error EmptyBundleHash();
    error EmptyDeviceKey();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @param id           1-based identifier. Zero means "does not exist".
    /// @param taskId       Off-chain task reference, kept as a string so the seed data and
    ///                     any future U-Report task IDs can be used verbatim. Grouping is
    ///                     done on the hash, so the string length costs storage but never
    ///                     lookup time.
    /// @param bundleHash   keccak256 of the signed ProofBundle (imageHash, geohash,
    ///                     capturedAt, deviceKey). The device signature itself stays
    ///                     off-chain; this hash is what makes it verifiable later.
    /// @param geohash      5-character geohash of the capture location.
    /// @param submittedAt  Anchoring time, not capture time. Capture time lives inside the
    ///                     signed bundle. The gap between the two is expected and is what
    ///                     offline submission looks like.
    /// @dev `submittedAt`, `attestCount` and `disputeCount` share one storage slot.
    struct Proof {
        uint256 id;
        string taskId;
        bytes32 bundleHash;
        string geohash;
        bytes32 deviceKeyHash;
        uint64 submittedAt;
        uint32 attestCount;
        uint32 disputeCount;
    }

    /// @param verifier Empty string for an anonymous corroboration, otherwise the name of
    ///                 the identity provider that vouched for this device. Stored rather
    ///                 than scored so clients can weight providers differently, and so a
    ///                 provider that is later distrusted can be discounted retroactively.
    /// @param geohash  Cell the corroborator acted from. Enables the same-location
    ///                 collusion heuristic client-side.
    struct Attestation {
        bytes32 deviceKeyHash;
        string verifier;
        string geohash;
        uint64 attestedAt;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice Can rotate the relayer. Held separately from the relayer key, which is
    ///         operational and lives on a server.
    address public owner;

    /// @notice The only address allowed to write. Pays gas on behalf of every submitter.
    address public relayer;

    /// @notice Total proofs anchored. Also the id of the most recent one.
    uint256 public proofCount;

    mapping(uint256 proofId => Proof) private _proofs;
    mapping(uint256 proofId => Attestation[]) private _attestations;
    mapping(uint256 proofId => Attestation[]) private _disputes;

    mapping(bytes32 taskIdHash => uint256[]) private _proofsByTask;

    /// @dev Indexed by cell so the attest screen and retroactive confirmation can both ask
    ///      "what else was reported here" without scanning every proof.
    mapping(bytes32 geohashHash => uint256[]) private _proofsByGeohash;

    /// @dev One action per device per proof, covering attest and dispute together. A device
    ///      that has disputed cannot then attest, and the submitter is pre-marked so it
    ///      cannot corroborate itself.
    mapping(uint256 proofId => mapping(bytes32 deviceKeyHash => bool)) private _hasActed;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ProofSubmitted(
        uint256 indexed proofId,
        bytes32 indexed taskIdHash,
        bytes32 indexed geohashHash,
        string taskId,
        string geohash,
        bytes32 bundleHash,
        bytes32 deviceKeyHash,
        uint64 submittedAt
    );

    event Attested(
        uint256 indexed proofId,
        bytes32 indexed deviceKeyHash,
        string verifier,
        string geohash,
        uint64 attestedAt
    );

    event Disputed(
        uint256 indexed proofId,
        bytes32 indexed deviceKeyHash,
        string verifier,
        string geohash,
        uint64 disputedAt
    );

    event RelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    // -------------------------------------------------------------------------
    // Construction and administration
    // -------------------------------------------------------------------------

    constructor(address initialOwner, address initialRelayer) {
        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();

        owner = initialOwner;
        relayer = initialRelayer;

        emit OwnerUpdated(address(0), initialOwner);
        emit RelayerUpdated(address(0), initialRelayer);
    }

    /// @notice Points the registry at a new relayer. Existing proofs are untouched, since
    ///         authorship was never tied to the relayer address.
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    /// @dev Single-step on purpose. A two-step handover is the safer pattern for long-lived
    ///      ownership and is the change to make before this leaves a testnet.
    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // Writes
    // -------------------------------------------------------------------------

    /// @notice Anchors a signed proof bundle.
    /// @dev The relayer is trusted to have verified the device signature before calling.
    ///      Verifying secp256r1 signatures on-chain is not practical here, so the contract
    ///      anchors what it is given and the bundle hash is what makes the relayer's claim
    ///      auditable after the fact.
    /// @return proofId The new proof's identifier.
    function submitProof(
        string calldata taskId,
        bytes32 bundleHash,
        string calldata geohash,
        bytes32 deviceKeyHash
    ) external onlyRelayer returns (uint256 proofId) {
        if (bundleHash == bytes32(0)) revert EmptyBundleHash();
        if (deviceKeyHash == bytes32(0)) revert EmptyDeviceKey();

        unchecked {
            proofId = ++proofCount;
        }

        uint64 submittedAt = uint64(block.timestamp);

        _proofs[proofId] = Proof({
            id: proofId,
            taskId: taskId,
            bundleHash: bundleHash,
            geohash: geohash,
            deviceKeyHash: deviceKeyHash,
            submittedAt: submittedAt,
            attestCount: 0,
            disputeCount: 0
        });

        bytes32 taskIdHash = keccak256(bytes(taskId));
        bytes32 geohashHash = keccak256(bytes(geohash));

        _proofsByTask[taskIdHash].push(proofId);
        _proofsByGeohash[geohashHash].push(proofId);

        // The submitter counts as having acted, which blocks self-corroboration.
        _hasActed[proofId][deviceKeyHash] = true;

        emit ProofSubmitted(
            proofId, taskIdHash, geohashHash, taskId, geohash, bundleHash, deviceKeyHash, submittedAt
        );
    }

    /// @notice Records that another device confirms this proof.
    /// @param verifier Identity provider that vouched for the corroborating device, or an
    ///                 empty string if the corroboration is anonymous.
    function attest(
        uint256 proofId,
        bytes32 deviceKeyHash,
        string calldata verifier,
        string calldata geohash
    ) external onlyRelayer {
        uint64 actedAt = _registerAction(proofId, deviceKeyHash);

        _attestations[proofId].push(
            Attestation({
                deviceKeyHash: deviceKeyHash,
                verifier: verifier,
                geohash: geohash,
                attestedAt: actedAt
            })
        );

        unchecked {
            ++_proofs[proofId].attestCount;
        }

        emit Attested(proofId, deviceKeyHash, verifier, geohash, actedAt);
    }

    /// @notice Records that another device contests this proof. The proof itself survives.
    function dispute(
        uint256 proofId,
        bytes32 deviceKeyHash,
        string calldata verifier,
        string calldata geohash
    ) external onlyRelayer {
        uint64 actedAt = _registerAction(proofId, deviceKeyHash);

        _disputes[proofId].push(
            Attestation({
                deviceKeyHash: deviceKeyHash,
                verifier: verifier,
                geohash: geohash,
                attestedAt: actedAt
            })
        );

        unchecked {
            ++_proofs[proofId].disputeCount;
        }

        emit Disputed(proofId, deviceKeyHash, verifier, geohash, actedAt);
    }

    /// @dev Shared precondition check and bookkeeping for attest and dispute.
    /// @return actedAt Block timestamp, returned so callers do not read it twice.
    function _registerAction(uint256 proofId, bytes32 deviceKeyHash)
        private
        returns (uint64 actedAt)
    {
        if (deviceKeyHash == bytes32(0)) revert EmptyDeviceKey();

        Proof storage proof = _proofs[proofId];
        if (proof.id == 0) revert ProofNotFound();
        if (proof.deviceKeyHash == deviceKeyHash) revert SelfAction();
        if (_hasActed[proofId][deviceKeyHash]) revert AlreadyActed();

        _hasActed[proofId][deviceKeyHash] = true;

        actedAt = uint64(block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getProof(uint256 proofId) external view returns (Proof memory proof) {
        proof = _proofs[proofId];
        if (proof.id == 0) revert ProofNotFound();
    }

    /// @notice Batch read for list screens.
    /// @dev Unknown ids come back zeroed rather than reverting, so one bad id in a panel
    ///      refresh does not blank the whole page. Callers should treat `id == 0` as absent.
    function getProofs(uint256[] calldata proofIds) external view returns (Proof[] memory proofs) {
        proofs = new Proof[](proofIds.length);
        for (uint256 i; i < proofIds.length;) {
            proofs[i] = _proofs[proofIds[i]];
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Returns the full list. Unbounded in principle, but a single task in a single
    ///      village stays small, and this is a view call. Pagination belongs here if the
    ///      registry ever holds a national dataset.
    function getProofsByTask(string calldata taskId) external view returns (uint256[] memory) {
        return _proofsByTask[keccak256(bytes(taskId))];
    }

    /// @notice Every proof anchored in a given geohash cell, oldest first.
    /// @dev Backs both the attest feed and retroactive confirmation: a new proof in a cell
    ///      is evidence about the older ones already there.
    function getProofsByGeohash(string calldata geohash) external view returns (uint256[] memory) {
        return _proofsByGeohash[keccak256(bytes(geohash))];
    }

    /// @notice Full corroboration records, including verifier and timing, so clients can
    ///         apply their own weighting and collusion rules.
    function getAttestations(uint256 proofId) external view returns (Attestation[] memory) {
        return _attestations[proofId];
    }

    function getDisputes(uint256 proofId) external view returns (Attestation[] memory) {
        return _disputes[proofId];
    }

    /// @notice Whether a device has already submitted, attested or disputed this proof.
    /// @dev The UI calls this before showing the corroborate button, so a blocked action
    ///      is never a failed transaction the user has to understand.
    function hasActed(uint256 proofId, bytes32 deviceKeyHash) external view returns (bool) {
        return _hasActed[proofId][deviceKeyHash];
    }
}
