// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MeetingStake {
    struct Meeting {
        string meetingId;
        string eventId;
        address organizer;
        uint256 requiredStake;
        uint256 startTime;
        uint256 endTime;
        uint256 checkInDeadline;
        string attendanceCode;
        uint256 codeValidUntil;
        bool isSettled;
        uint256 totalStaked;
        uint256 totalRefunded;
        uint256 totalForfeited;
    }

    struct Stake {
        address staker;
        uint256 amount;
        uint256 stakedAt;
        bool hasCheckedIn;
        uint256 checkInTime;
        bool isRefunded;
    }

    mapping(string => Meeting) public meetings;
    mapping(string => mapping(address => Stake)) public stakes;
    mapping(string => address[]) public meetingStakers;

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

    modifier onlyOrganizer(string memory meetingId) {
        require(
            meetings[meetingId].organizer == msg.sender,
            "Only organizer can perform this action"
        );
        _;
    }

    modifier meetingExists(string memory meetingId) {
        require(
            meetings[meetingId].startTime > 0,
            "Meeting does not exist"
        );
        _;
    }

    function createMeeting(
        string memory meetingId,
        string memory eventId,
        uint256 requiredStake,
        uint256 startTime,
        uint256 endTime
    ) external {
        require(
            meetings[meetingId].startTime == 0,
            "Meeting already exists"
        );
        require(requiredStake > 0, "Stake must be greater than 0");
        require(
            startTime > block.timestamp,
            "Start time must be in the future"
        );
        require(endTime > startTime, "End time must be after start time");

        Meeting storage meeting = meetings[meetingId];
        meeting.meetingId = meetingId;
        meeting.eventId = eventId;
        meeting.organizer = msg.sender;
        meeting.requiredStake = requiredStake;
        meeting.startTime = startTime;
        meeting.endTime = endTime;
        meeting.checkInDeadline = endTime + 15 minutes;

        emit MeetingCreated(
            meetingId,
            msg.sender,
            requiredStake,
            startTime,
            endTime
        );
    }

    function stake(string memory meetingId) 
        external 
        payable 
        meetingExists(meetingId) 
    {
        Meeting storage meeting = meetings[meetingId];
        require(
            msg.value == meeting.requiredStake,
            "Incorrect stake amount"
        );
        require(
            stakes[meetingId][msg.sender].amount == 0,
            "Already staked for this meeting"
        );
        require(
            block.timestamp < meeting.startTime - 1 hours,
            "Staking deadline passed"
        );

        Stake storage userStake = stakes[meetingId][msg.sender];
        userStake.staker = msg.sender;
        userStake.amount = msg.value;
        userStake.stakedAt = block.timestamp;
        userStake.hasCheckedIn = false;
        userStake.isRefunded = false;

        meetingStakers[meetingId].push(msg.sender);
        meeting.totalStaked += msg.value;

        emit StakeDeposited(meetingId, msg.sender, msg.value);
    }

    function generateAttendanceCode(string memory meetingId, string memory code)
        external
        meetingExists(meetingId)
        onlyOrganizer(meetingId)
    {
        Meeting storage meeting = meetings[meetingId];
        require(
            block.timestamp >= meeting.startTime,
            "Meeting has not started"
        );
        require(
            block.timestamp <= meeting.endTime,
            "Meeting has ended"
        );

        meeting.attendanceCode = code;
        meeting.codeValidUntil = meeting.checkInDeadline;

        emit AttendanceCodeGenerated(meetingId, code, meeting.codeValidUntil);
    }

    function submitAttendanceCode(string memory meetingId, string memory code)
        external
        meetingExists(meetingId)
    {
        Meeting storage meeting = meetings[meetingId];
        Stake storage userStake = stakes[meetingId][msg.sender];

        require(userStake.amount > 0, "No stake found for this address");
        require(!userStake.hasCheckedIn, "Already checked in");
        require(
            keccak256(bytes(meeting.attendanceCode)) == keccak256(bytes(code)),
            "Invalid attendance code"
        );
        require(
            block.timestamp <= meeting.codeValidUntil,
            "Code has expired"
        );

        userStake.hasCheckedIn = true;
        userStake.checkInTime = block.timestamp;

        emit AttendanceConfirmed(meetingId, msg.sender, code);
    }

    function settleMeeting(string memory meetingId)
        external
        meetingExists(meetingId)
    {
        Meeting storage meeting = meetings[meetingId];
        require(!meeting.isSettled, "Meeting already settled");
        require(
            block.timestamp > meeting.checkInDeadline,
            "Check-in period not ended"
        );

        uint256 totalRefunded = 0;
        uint256 totalForfeited = 0;
        address[] memory stakers = meetingStakers[meetingId];

        for (uint256 i = 0; i < stakers.length; i++) {
            address stakerAddress = stakers[i];
            Stake storage userStake = stakes[meetingId][stakerAddress];

            if (userStake.hasCheckedIn && !userStake.isRefunded) {
                // Refund to attendees
                uint256 refundAmount = userStake.amount;
                userStake.isRefunded = true;
                totalRefunded += refundAmount;
                
                (bool success, ) = stakerAddress.call{value: refundAmount}("");
                require(success, "Refund transfer failed");
                
                emit StakeRefunded(meetingId, stakerAddress, refundAmount);
            } else if (!userStake.hasCheckedIn) {
                // Forfeit for absentees
                totalForfeited += userStake.amount;
                emit StakeForfeited(meetingId, stakerAddress, userStake.amount);
            }
        }

        // Transfer forfeited funds to organizer
        if (totalForfeited > 0) {
            (bool success, ) = meeting.organizer.call{value: totalForfeited}("");
            require(success, "Organizer transfer failed");
        }

        meeting.isSettled = true;
        meeting.totalRefunded = totalRefunded;
        meeting.totalForfeited = totalForfeited;

        emit MeetingSettled(meetingId, totalRefunded, totalForfeited);
    }

    function getMeetingInfo(string memory meetingId)
        external
        view
        returns (Meeting memory)
    {
        return meetings[meetingId];
    }

    function getStakeInfo(string memory meetingId, address staker)
        external
        view
        returns (Stake memory)
    {
        return stakes[meetingId][staker];
    }

    function getMeetingStakers(string memory meetingId)
        external
        view
        returns (address[] memory)
    {
        return meetingStakers[meetingId];
    }

    function hasStaked(string memory meetingId, address staker)
        external
        view
        returns (bool)
    {
        return stakes[meetingId][staker].amount > 0;
    }
}