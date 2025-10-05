// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {MeetingStake} from "../src/MeetingStake.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MeetingStake meetingStake = new MeetingStake();
        
        console.log("MeetingStake deployed to:", address(meetingStake));
        console.log("Network: Flow EVM Testnet");
        console.log("Chain ID: 545");
        
        vm.stopBroadcast();
    }
}