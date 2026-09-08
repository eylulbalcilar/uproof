// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ProofRegistry
/// @notice Anchors citizen-submitted field proofs and the corroborations they receive.
/// @dev Design constraints that shaped this contract:
///
///      1. Submitters have a keypair, not a wallet. Field users cannot fund gas, so a
///         backend relayer signs every transaction. `msg.sender` is therefore never the
///         author of a proof and carries no authorization meaning beyond "the relayer
///         accepted this". Identity is expressed by the reporter's device key hash.
///
///      2. Nothing that could identify a person is stored. Photos never reach the chain,
///         only their fingerprint. Location is a 5-character geohash (~5km cell) plus a
///         human-readable region name, never exact coordinates.
///
///      3. Scoring is deliberately off-chain. Corroboration weights, collusion penalties
///         and density-scaled thresholds are policy, and policy changes faster than a
///         deployed contract should. This contract stores only facts.
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
    error EmptyFingerprint();
    error EmptyDeviceKey();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Proof {
        uint256 id;
        /// What was reported, in the words of the task it belongs to.
        string taskId;
        /// Human-readable region, for anyone reading the raw chain record.
        /// Coarse enough that it identifies nobody: a city or district, never
        /// a street.
        string regionName;
        /// keccak256 of the photo bytes. The photo itself never leaves the device.
        bytes32 photoFingerprint;
        /// 5-character geohash, roughly a 5km cell.
        string locationArea;
        /// keccak256 of the public key that signed this on the reporter's phone.
        bytes32 reporterDevice;
        /// Unix seconds when the shutter fired, signed on the device.
        uint64 capturedAt;
        /// Unix seconds when the relayer anchored it. The gap between this and
        /// capturedAt is what offline submission looks like.
        uint64 recordedAt;
        uint32 confirmations;
        uint32 disputes;
    }

    /// @param verifier Empty string for an anonymous corroboration, otherwise the name of
    ///                 the identity provider that vouched for this device. Stored rather
    ///                 than scored so clients can weight providers differently, and so a
    ///                 provider that is later distrusted can be discounted retroactively.
    struct Attestation {
        bytes32 confirmerDevice;
        string verifier;
        string locationArea;
        uint64 confirmedAt;
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

    /// @dev Indexed by cell so the confirmation screen and retroactive confirmation can
    ///      both ask "what else was reported here" without scanning every proof.
    mapping(bytes32 locationAreaHash => uint256[]) private _proofsByArea;

    /// @dev One action per device per proof, covering confirm and dispute together. A
    ///      device that has disputed cannot then confirm, and the reporter is pre-marked
    ///      so it cannot corroborate itself.
    mapping(uint256 proofId => mapping(bytes32 device => bool)) private _hasActed;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ProofSubmitted(
        uint256 indexed proofId,
        bytes32 indexed taskIdHash,
        bytes32 indexed locationAreaHash,
        string taskId,
        string regionName,
        string locationArea,
        bytes32 photoFingerprint,
        bytes32 reporterDevice,
        uint64 capturedAt,
        uint64 recordedAt
    );

    event ProofConfirmed(
        uint256 indexed proofId,
        bytes32 indexed confirmerDevice,
        string verifier,
        string locationArea,
        uint64 confirmedAt
    );

    event ProofDisputed(
        uint256 indexed proofId,
        bytes32 indexed disputerDevice,
        string verifier,
        string locationArea,
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

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // Writes
    // -------------------------------------------------------------------------

    /// @notice Anchors a signed proof.
    /// @dev The relayer verifies the device signature before calling. Verifying secp256r1
    ///      on-chain is not practical here, so the contract anchors what it is given and
    ///      the fingerprint is what makes the relayer's claim auditable after the fact.
    function submitProof(
        string calldata taskId,
        string calldata regionName,
        bytes32 photoFingerprint,
        string calldata locationArea,
        bytes32 reporterDevice,
        uint64 capturedAt
    ) external onlyRelayer returns (uint256 proofId) {
        if (photoFingerprint == bytes32(0)) revert EmptyFingerprint();
        if (reporterDevice == bytes32(0)) revert EmptyDeviceKey();

        unchecked {
            proofId = ++proofCount;
        }

        uint64 recordedAt = uint64(block.timestamp);

        _proofs[proofId] = Proof({
            id: proofId,
            taskId: taskId,
            regionName: regionName,
            photoFingerprint: photoFingerprint,
            locationArea: locationArea,
            reporterDevice: reporterDevice,
            capturedAt: capturedAt,
            recordedAt: recordedAt,
            confirmations: 0,
            disputes: 0
        });

        bytes32 taskIdHash = keccak256(bytes(taskId));
        bytes32 locationAreaHash = keccak256(bytes(locationArea));

        _proofsByTask[taskIdHash].push(proofId);
        _proofsByArea[locationAreaHash].push(proofId);

        // The reporter counts as having acted, which blocks self-corroboration.
        _hasActed[proofId][reporterDevice] = true;

        emit ProofSubmitted(
            proofId,
            taskIdHash,
            locationAreaHash,
            taskId,
            regionName,
            locationArea,
            photoFingerprint,
            reporterDevice,
            capturedAt,
            recordedAt
        );
    }

    /// @notice Records that another device confirms this proof.
    function attest(
        uint256 proofId,
        bytes32 confirmerDevice,
        string calldata verifier,
        string calldata locationArea
    ) external onlyRelayer {
        uint64 actedAt = _registerAction(proofId, confirmerDevice);

        _attestations[proofId].push(
            Attestation({
                confirmerDevice: confirmerDevice,
                verifier: verifier,
                locationArea: locationArea,
                confirmedAt: actedAt
            })
        );

        unchecked {
            ++_proofs[proofId].confirmations;
        }

        emit ProofConfirmed(proofId, confirmerDevice, verifier, locationArea, actedAt);
    }

    /// @notice Records that another device contests this proof. The proof itself survives.
    function dispute(
        uint256 proofId,
        bytes32 disputerDevice,
        string calldata verifier,
        string calldata locationArea
    ) external onlyRelayer {
        uint64 actedAt = _registerAction(proofId, disputerDevice);

        _disputes[proofId].push(
            Attestation({
                confirmerDevice: disputerDevice,
                verifier: verifier,
                locationArea: locationArea,
                confirmedAt: actedAt
            })
        );

        unchecked {
            ++_proofs[proofId].disputes;
        }

        emit ProofDisputed(proofId, disputerDevice, verifier, locationArea, actedAt);
    }

    /// @dev Shared precondition check and bookkeeping for confirm and dispute.
    function _registerAction(uint256 proofId, bytes32 device)
        private
        returns (uint64 actedAt)
    {
        if (device == bytes32(0)) revert EmptyDeviceKey();

        Proof storage proof = _proofs[proofId];
        if (proof.id == 0) revert ProofNotFound();
        if (proof.reporterDevice == device) revert SelfAction();
        if (_hasActed[proofId][device]) revert AlreadyActed();

        _hasActed[proofId][device] = true;

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

    function getProofsByTask(string calldata taskId) external view returns (uint256[] memory) {
        return _proofsByTask[keccak256(bytes(taskId))];
    }

    /// @notice Every proof anchored in a given area, oldest first.
    /// @dev Backs both the confirmation feed and retroactive confirmation: a new proof in
    ///      an area is evidence about the older ones already there.
    function getProofsByGeohash(string calldata locationArea) external view returns (uint256[] memory) {
        return _proofsByArea[keccak256(bytes(locationArea))];
    }

    /// @notice Full corroboration records, including verifier and timing, so clients can
    ///         apply their own weighting and collusion rules.
    function getAttestations(uint256 proofId) external view returns (Attestation[] memory) {
        return _attestations[proofId];
    }

    function getDisputes(uint256 proofId) external view returns (Attestation[] memory) {
        return _disputes[proofId];
    }

    /// @notice Whether a device has already reported, confirmed or disputed this proof.
    function hasActed(uint256 proofId, bytes32 device) external view returns (bool) {
        return _hasActed[proofId][device];
    }
}
