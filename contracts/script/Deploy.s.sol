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
        
        console.log("====================================");
        console.log("Base Hackathon Deployment");
        console.log("====================================");
        console.log("MeetingStake deployed to:", address(meetingStake));
        console.log("Network: Base Sepolia Testnet");
        console.log("Chain ID: 84532");
        console.log("====================================");
        console.log("Verify on Basescan:");
        console.log(string.concat("https://sepolia.basescan.org/address/", vm.toString(address(meetingStake))));
        console.log("====================================");
        
        vm.stopBroadcast();
    }
}