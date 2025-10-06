// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {MeetingStake} from "../src/MeetingStake.sol";

contract MeetingStakeTest is Test {
    MeetingStake public meetingStake;
    
    address public organizer = address(0x1);
    address public attendee1 = address(0x2);
    address public attendee2 = address(0x3);
    address public attendee3 = address(0x4);
    address public nonStaker = address(0x5);
    
    uint256 public constant REQUIRED_STAKE = 0.01 ether;
    uint256 public constant MEETING_DURATION = 1 hours;
    
    string public constant MEETING_ID = "meeting-001";
    string public constant EVENT_ID = "event-001";
    string public constant ATTENDANCE_CODE = "BASE2024";
    
    event MeetingCreated(
        string indexed meetingId,
        address indexed organizer,
        uint256 requiredStake,
        uint256 startTime,
        uint256 endTime
    );
    
    event StakeDeposited(
        string indexed meetingId,
        address indexed staker,
        uint256 amount
    );
    
    event AttendanceCodeGenerated(
        string indexed meetingId,
        string code,
        uint256 validUntil
    );
    
    event AttendanceConfirmed(
        string indexed meetingId,
        address indexed attendee,
        string code
    );
    
    event StakeRefunded(
        string indexed meetingId,
        address indexed attendee,
        uint256 amount
    );
    
    event StakeForfeited(
        string indexed meetingId,
        address indexed absentee,
        uint256 amount
    );
    
    event MeetingSettled(
        string indexed meetingId,
        uint256 totalRefunded,
        uint256 totalForfeited
    );

    function setUp() public {
        meetingStake = new MeetingStake();
        
        // Fund test accounts
        vm.deal(organizer, 10 ether);
        vm.deal(attendee1, 10 ether);
        vm.deal(attendee2, 10 ether);
        vm.deal(attendee3, 10 ether);
        vm.deal(nonStaker, 10 ether);
    }

    // ============ Meeting Creation Tests ============

    function testCreateMeeting() public {
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        vm.expectEmit(true, true, false, true);
        emit MeetingCreated(MEETING_ID, organizer, REQUIRED_STAKE, startTime, endTime);
        
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
        
        MeetingStake.Meeting memory meeting = meetingStake.getMeetingInfo(MEETING_ID);
        
        assertEq(meeting.meetingId, MEETING_ID);
        assertEq(meeting.eventId, EVENT_ID);
        assertEq(meeting.organizer, organizer);
        assertEq(meeting.requiredStake, REQUIRED_STAKE);
        assertEq(meeting.startTime, startTime);
        assertEq(meeting.endTime, endTime);
        assertEq(meeting.checkInDeadline, endTime + 15 minutes);
        assertFalse(meeting.isSettled);
    }

    function testCannotCreateDuplicateMeeting() public {
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
        
        vm.prank(organizer);
        vm.expectRevert("Meeting already exists");
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
    }

    function testCannotCreateMeetingWithZeroStake() public {
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        vm.expectRevert("Stake must be greater than 0");
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            0,
            startTime,
            endTime
        );
    }

    function testCannotCreateMeetingInPast() public {
        // Move forward in time first to avoid underflow
        vm.warp(block.timestamp + 2 hours);
        
        uint256 startTime = block.timestamp - 1 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        vm.expectRevert("Start time must be in the future");
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
    }

    function testCannotCreateMeetingWithInvalidEndTime() public {
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime - 1 hours;
        
        vm.prank(organizer);
        vm.expectRevert("End time must be after start time");
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
    }

    // ============ Staking Tests ============

    function testStakeForMeeting() public {
        _createTestMeeting();
        
        vm.prank(attendee1);
        vm.expectEmit(true, true, false, true);
        emit StakeDeposited(MEETING_ID, attendee1, REQUIRED_STAKE);
        
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        MeetingStake.Stake memory stake = meetingStake.getStakeInfo(MEETING_ID, attendee1);
        assertEq(stake.staker, attendee1);
        assertEq(stake.amount, REQUIRED_STAKE);
        assertFalse(stake.hasCheckedIn);
        assertFalse(stake.isRefunded);
        
        assertTrue(meetingStake.hasStaked(MEETING_ID, attendee1));
    }

    function testCannotStakeWithIncorrectAmount() public {
        _createTestMeeting();
        
        vm.prank(attendee1);
        vm.expectRevert("Incorrect stake amount");
        meetingStake.stake{value: REQUIRED_STAKE / 2}(MEETING_ID);
        
        vm.prank(attendee1);
        vm.expectRevert("Incorrect stake amount");
        meetingStake.stake{value: REQUIRED_STAKE * 2}(MEETING_ID);
    }

    function testCannotStakeTwice() public {
        _createTestMeeting();
        
        vm.prank(attendee1);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        vm.prank(attendee1);
        vm.expectRevert("Already staked for this meeting");
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
    }

    function testCannotStakeAfterDeadline() public {
        _createTestMeeting();
        
        // Move time to 30 minutes before meeting (past 1 hour deadline)
        vm.warp(block.timestamp + 90 minutes);
        
        vm.prank(attendee1);
        vm.expectRevert("Staking deadline passed");
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
    }

    function testCannotStakeForNonExistentMeeting() public {
        vm.prank(attendee1);
        vm.expectRevert("Meeting does not exist");
        meetingStake.stake{value: REQUIRED_STAKE}("non-existent");
    }

    function testMultipleStakers() public {
        _createTestMeeting();
        
        vm.prank(attendee1);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        vm.prank(attendee2);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        vm.prank(attendee3);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        address[] memory stakers = meetingStake.getMeetingStakers(MEETING_ID);
        assertEq(stakers.length, 3);
        assertEq(stakers[0], attendee1);
        assertEq(stakers[1], attendee2);
        assertEq(stakers[2], attendee3);
        
        MeetingStake.Meeting memory meeting = meetingStake.getMeetingInfo(MEETING_ID);
        assertEq(meeting.totalStaked, REQUIRED_STAKE * 3);
    }

    // ============ Attendance Code Tests ============

    function testGenerateAttendanceCode() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        // Move to meeting start time
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        vm.expectEmit(true, false, false, true);
        emit AttendanceCodeGenerated(MEETING_ID, ATTENDANCE_CODE, block.timestamp + MEETING_DURATION + 15 minutes);
        
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        MeetingStake.Meeting memory meeting = meetingStake.getMeetingInfo(MEETING_ID);
        assertEq(meeting.attendanceCode, ATTENDANCE_CODE);
        assertEq(meeting.codeValidUntil, block.timestamp + MEETING_DURATION + 15 minutes);
    }

    function testOnlyOrganizerCanGenerateCode() public {
        _createTestMeeting();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(attendee1);
        vm.expectRevert("Only organizer can perform this action");
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
    }

    function testCannotGenerateCodeBeforeMeeting() public {
        _createTestMeeting();
        
        vm.prank(organizer);
        vm.expectRevert("Meeting has not started");
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
    }

    function testCannotGenerateCodeAfterMeeting() public {
        _createTestMeeting();
        
        // Move past meeting end time
        vm.warp(block.timestamp + 4 hours);
        
        vm.prank(organizer);
        vm.expectRevert("Meeting has ended");
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
    }

    // ============ Check-in Tests ============

    function testSubmitAttendanceCode() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee1);
        vm.expectEmit(true, true, false, true);
        emit AttendanceConfirmed(MEETING_ID, attendee1, ATTENDANCE_CODE);
        
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        MeetingStake.Stake memory stake = meetingStake.getStakeInfo(MEETING_ID, attendee1);
        assertTrue(stake.hasCheckedIn);
        assertEq(stake.checkInTime, block.timestamp);
    }

    function testCannotSubmitInvalidCode() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee1);
        vm.expectRevert("Invalid attendance code");
        meetingStake.submitAttendanceCode(MEETING_ID, "WRONG_CODE");
    }

    function testCannotCheckInTwice() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee1);
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee1);
        vm.expectRevert("Already checked in");
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
    }

    function testCannotCheckInWithoutStake() public {
        _createTestMeeting();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(nonStaker);
        vm.expectRevert("No stake found for this address");
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
    }

    function testCannotCheckInAfterDeadline() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        // Move past check-in deadline
        vm.warp(block.timestamp + MEETING_DURATION + 20 minutes);
        
        vm.prank(attendee1);
        vm.expectRevert("Code has expired");
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
    }

    // ============ Settlement Tests ============

    function testSettleMeetingWithAllAttendees() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        // All attendees check in
        vm.prank(attendee1);
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee2);
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee3);
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        // Record balances before settlement
        uint256 attendee1BalanceBefore = attendee1.balance;
        uint256 attendee2BalanceBefore = attendee2.balance;
        uint256 attendee3BalanceBefore = attendee3.balance;
        
        // Move past check-in deadline
        vm.warp(block.timestamp + MEETING_DURATION + 20 minutes);
        
        vm.expectEmit(true, false, false, true);
        emit MeetingSettled(MEETING_ID, REQUIRED_STAKE * 3, 0);
        
        meetingStake.settleMeeting(MEETING_ID);
        
        // Check refunds
        assertEq(attendee1.balance, attendee1BalanceBefore + REQUIRED_STAKE);
        assertEq(attendee2.balance, attendee2BalanceBefore + REQUIRED_STAKE);
        assertEq(attendee3.balance, attendee3BalanceBefore + REQUIRED_STAKE);
        
        MeetingStake.Meeting memory meeting = meetingStake.getMeetingInfo(MEETING_ID);
        assertTrue(meeting.isSettled);
        assertEq(meeting.totalRefunded, REQUIRED_STAKE * 3);
        assertEq(meeting.totalForfeited, 0);
    }

    function testSettleMeetingWithAbsentees() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        // Only attendee1 checks in
        vm.prank(attendee1);
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        uint256 attendee1BalanceBefore = attendee1.balance;
        uint256 organizerBalanceBefore = organizer.balance;
        
        // Move past check-in deadline
        vm.warp(block.timestamp + MEETING_DURATION + 20 minutes);
        
        vm.expectEmit(true, false, false, true);
        emit MeetingSettled(MEETING_ID, REQUIRED_STAKE, REQUIRED_STAKE * 2);
        
        meetingStake.settleMeeting(MEETING_ID);
        
        // Check refund for attendee1
        assertEq(attendee1.balance, attendee1BalanceBefore + REQUIRED_STAKE);
        
        // Check forfeitures went to organizer
        assertEq(organizer.balance, organizerBalanceBefore + (REQUIRED_STAKE * 2));
        
        MeetingStake.Meeting memory meeting = meetingStake.getMeetingInfo(MEETING_ID);
        assertTrue(meeting.isSettled);
        assertEq(meeting.totalRefunded, REQUIRED_STAKE);
        assertEq(meeting.totalForfeited, REQUIRED_STAKE * 2);
    }

    function testCannotSettleMeetingTwice() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.warp(block.timestamp + MEETING_DURATION + 20 minutes);
        
        meetingStake.settleMeeting(MEETING_ID);
        
        vm.expectRevert("Meeting already settled");
        meetingStake.settleMeeting(MEETING_ID);
    }

    function testCannotSettleBeforeCheckInDeadline() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.expectRevert("Check-in period not ended");
        meetingStake.settleMeeting(MEETING_ID);
    }

    function testCannotSettleNonExistentMeeting() public {
        vm.expectRevert("Meeting does not exist");
        meetingStake.settleMeeting("non-existent");
    }

    // ============ Gas Tests ============

    function testGasCreateMeeting() public {
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        uint256 gasBefore = gasleft();
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for createMeeting:", gasUsed);
        assertTrue(gasUsed < 200000, "createMeeting uses too much gas");
    }

    function testGasStake() public {
        _createTestMeeting();
        
        vm.prank(attendee1);
        uint256 gasBefore = gasleft();
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for stake:", gasUsed);
        assertTrue(gasUsed < 200000, "stake uses too much gas");
    }

    function testGasSettlement() public {
        _createTestMeeting();
        _stakeForAttendees();
        
        vm.warp(block.timestamp + 2 hours);
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.prank(attendee1);
        meetingStake.submitAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.warp(block.timestamp + MEETING_DURATION + 20 minutes);
        
        uint256 gasBefore = gasleft();
        meetingStake.settleMeeting(MEETING_ID);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for settleMeeting (3 stakers, 1 attendee):", gasUsed);
        assertTrue(gasUsed < 300000, "settleMeeting uses too much gas");
    }

    // ============ Edge Cases & Security Tests ============

    function testReentrancyProtection() public {
        // Deploy malicious contract that tries reentrancy
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(meetingStake));
        vm.deal(address(attacker), 10 ether);
        
        _createTestMeeting();
        
        // Attacker stakes
        attacker.stake(MEETING_ID, REQUIRED_STAKE);
        
        vm.warp(block.timestamp + 2 hours);
        vm.prank(organizer);
        meetingStake.generateAttendanceCode(MEETING_ID, ATTENDANCE_CODE);
        
        // Attacker checks in
        attacker.submitCode(MEETING_ID, ATTENDANCE_CODE);
        
        vm.warp(block.timestamp + MEETING_DURATION + 20 minutes);
        
        // Settlement should succeed without reentrancy
        meetingStake.settleMeeting(MEETING_ID);
        
        // Verify attacker only got refunded once
        assertEq(attacker.withdrawalCount(), 1);
    }

    function testFuzzStakeAmount(uint256 stakeAmount) public {
        vm.assume(stakeAmount > 0 && stakeAmount < 100 ether);
        
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        meetingStake.createMeeting(
            "fuzz-meeting",
            EVENT_ID,
            stakeAmount,
            startTime,
            endTime
        );
        
        vm.deal(attendee1, stakeAmount * 2);
        vm.prank(attendee1);
        meetingStake.stake{value: stakeAmount}("fuzz-meeting");
        
        MeetingStake.Stake memory stake = meetingStake.getStakeInfo("fuzz-meeting", attendee1);
        assertEq(stake.amount, stakeAmount);
    }

    // ============ Helper Functions ============

    function _createTestMeeting() internal {
        uint256 startTime = block.timestamp + 2 hours;
        uint256 endTime = startTime + MEETING_DURATION;
        
        vm.prank(organizer);
        meetingStake.createMeeting(
            MEETING_ID,
            EVENT_ID,
            REQUIRED_STAKE,
            startTime,
            endTime
        );
    }

    function _stakeForAttendees() internal {
        vm.prank(attendee1);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        vm.prank(attendee2);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
        
        vm.prank(attendee3);
        meetingStake.stake{value: REQUIRED_STAKE}(MEETING_ID);
    }
}

// Reentrancy attack contract for testing
contract ReentrancyAttacker {
    MeetingStake public target;
    uint256 public withdrawalCount;
    
    constructor(address _target) {
        target = MeetingStake(_target);
    }
    
    function stake(string memory meetingId, uint256 amount) external {
        target.stake{value: amount}(meetingId);
    }
    
    function submitCode(string memory meetingId, string memory code) external {
        target.submitAttendanceCode(meetingId, code);
    }
    
    receive() external payable {
        withdrawalCount++;
        if (withdrawalCount < 2) {
            // Try to trigger another withdrawal
            try target.settleMeeting("meeting-001") {} catch {}
        }
    }
}