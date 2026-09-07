// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ProofRegistry} from "../src/ProofRegistry.sol";

/// @notice Deploys ProofRegistry to the configured network.
/// @dev Owner and relayer both default to the deployer. Set RELAYER_ADDRESS when the
///      backend signs with a different key than the one that deployed.
contract Deploy is Script {
    function run() external returns (ProofRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address relayer = vm.envOr("RELAYER_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);
        registry = new ProofRegistry(deployer, relayer);
        vm.stopBroadcast();

        console.log("ProofRegistry:", address(registry));
        console.log("owner:", deployer);
        console.log("relayer:", relayer);
    }
}
