#!/bin/bash

# Script to verify meeting on Anvil using cast (Foundry)
# Usage: ./scripts/cast-verify.sh <meetingId>

MEETING_ID=${1:-"test-meeting-123"}
CONTRACT="0x5FbDB2315678afecb367f032d93F642f64180aa3"
RPC="http://127.0.0.1:8545"

echo "=================================================="
echo "🔍 CAST VERIFICATION FOR ANVIL"
echo "=================================================="
echo "Meeting ID: $MEETING_ID"
echo "Contract: $CONTRACT"
echo "--------------------------------------------------"

# Check if cast is installed
if ! command -v cast &> /dev/null; then
    echo "❌ Cast (Foundry) is not installed!"
    echo "Install it with: curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

echo ""
echo "📊 Getting Meeting Info..."
echo "--------------------------------------------------"
cast call $CONTRACT \
    "getMeetingInfo(string)(string,string,address,uint256,uint256,uint256,uint256,string,uint256,bool,uint256,uint256,uint256)" \
    "$MEETING_ID" \
    --rpc-url $RPC 2>/dev/null | {
    read meetingId
    read eventId  
    read organizer
    read requiredStake
    read startTime
    read endTime
    read checkInDeadline
    read attendanceCode
    read codeValidUntil
    read isSettled
    read totalStaked
    read totalRefunded
    read totalForfeited
    
    if [ "$organizer" = "0x0000000000000000000000000000000000000000" ]; then
        echo "❌ Meeting NOT found on blockchain!"
        exit 1
    fi
    
    echo "✅ Meeting FOUND on blockchain!"
    echo ""
    echo "Meeting ID: $meetingId"
    echo "Event ID: $eventId"
    echo "Organizer: $organizer"
    echo "Required Stake: $(cast --from-wei $requiredStake) ETH"
    echo "Start Time: $(date -r $(($startTime)) 2>/dev/null || echo $startTime)"
    echo "End Time: $(date -r $(($endTime)) 2>/dev/null || echo $endTime)"
    echo "Total Staked: $(cast --from-wei $totalStaked) ETH"
    echo "Is Settled: $isSettled"
}

echo ""
echo "👥 Getting Stakers..."
echo "--------------------------------------------------"
STAKERS=$(cast call $CONTRACT \
    "getMeetingStakers(string)(address[])" \
    "$MEETING_ID" \
    --rpc-url $RPC 2>/dev/null)

if [ -z "$STAKERS" ] || [ "$STAKERS" = "[]" ]; then
    echo "No stakers yet."
else
    echo "Stakers: $STAKERS"
fi

echo ""
echo "📜 Recent Events (last 50 blocks)..."
echo "--------------------------------------------------"
CURRENT_BLOCK=$(cast block-number --rpc-url $RPC)
FROM_BLOCK=$((CURRENT_BLOCK - 50))

echo "Checking blocks $FROM_BLOCK to $CURRENT_BLOCK"
cast logs \
    --from-block $FROM_BLOCK \
    --address $CONTRACT \
    --rpc-url $RPC 2>/dev/null | head -20

echo ""
echo "=================================================="
echo "✅ Verification Complete"
echo "=================================================="