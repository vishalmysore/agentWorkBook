#!/usr/bin/env node

/**
 * Gun.js Synchronization Test
 * Tests if two Gun instances can sync data with each other
 */

const Gun = require('gun');
require('gun/sea');

const RELAY_URL = 'https://vishalmysore-agentworkbookrelayserver.hf.space/gun';

console.log('🧪 Starting Gun.js Synchronization Test\n');
console.log(`Relay: ${RELAY_URL}\n`);

// Create two separate Gun instances
const gun1 = Gun({
  peers: [RELAY_URL],
  localStorage: false,
  radisk: false
});

const gun2 = Gun({
  peers: [RELAY_URL],
  localStorage: false,
  radisk: false
});

// Test ID to avoid conflicts
const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const testPath = `gun-sync-test/${testId}`;

console.log(`Test ID: ${testId}`);
console.log(`Test Path: ${testPath}\n`);

// Track results
let gun1Wrote = false;
let gun2Read = false;
let gun2Wrote = false;
let gun1ReadBack = false;

// Timeout for test
const TEST_TIMEOUT = 15000;
const startTime = Date.now();

// Test 1: Gun1 writes, Gun2 reads
console.log('📝 Test 1: Gun1 writing data...');
const testData1 = {
  message: 'Hello from Gun1',
  timestamp: Date.now(),
  source: 'gun1'
};

gun1.get(testPath).get('data1').put(testData1, (ack) => {
  if (ack.err) {
    console.error('❌ Gun1 write error:', ack.err);
  } else {
    gun1Wrote = true;
    console.log('✅ Gun1 wrote data successfully');
  }
});

// Gun2 listens for Gun1's data
console.log('👂 Gun2 listening for Gun1\'s data...');
gun2.get(testPath).get('data1').on((data, key) => {
  if (data && !gun2Read) {
    gun2Read = true;
    const elapsed = Date.now() - startTime;
    console.log(`✅ Gun2 received data from Gun1 (${elapsed}ms):`, data);
    
    // Test 2: Gun2 writes back, Gun1 reads
    setTimeout(() => {
      console.log('\n📝 Test 2: Gun2 writing response...');
      const testData2 = {
        message: 'Hello back from Gun2',
        timestamp: Date.now(),
        source: 'gun2',
        receivedFrom: data.source
      };
      
      gun2.get(testPath).get('data2').put(testData2, (ack) => {
        if (ack.err) {
          console.error('❌ Gun2 write error:', ack.err);
        } else {
          gun2Wrote = true;
          console.log('✅ Gun2 wrote response successfully');
        }
      });
    }, 500);
  }
});

// Gun1 listens for Gun2's response
console.log('👂 Gun1 listening for Gun2\'s response...\n');
gun1.get(testPath).get('data2').on((data, key) => {
  if (data && !gun1ReadBack) {
    gun1ReadBack = true;
    const elapsed = Date.now() - startTime;
    console.log(`✅ Gun1 received response from Gun2 (${elapsed}ms):`, data);
    
    // All tests complete
    setTimeout(() => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 TEST RESULTS');
      console.log('='.repeat(60));
      console.log(`Total time: ${Date.now() - startTime}ms`);
      console.log(`Gun1 Write: ${gun1Wrote ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Gun2 Read: ${gun2Read ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Gun2 Write: ${gun2Wrote ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Gun1 Read: ${gun1ReadBack ? '✅ PASS' : '❌ FAIL'}`);
      
      const allPass = gun1Wrote && gun2Read && gun2Wrote && gun1ReadBack;
      console.log('='.repeat(60));
      if (allPass) {
        console.log('🎉 ALL TESTS PASSED - Gun.js sync is working!');
      } else {
        console.log('❌ SOME TESTS FAILED - Gun.js sync has issues');
      }
      console.log('='.repeat(60));
      
      process.exit(allPass ? 0 : 1);
    }, 2000);
  }
});

// Test 3: Direct polling test (like validators use)
setTimeout(() => {
  console.log('\n📡 Test 3: Direct polling test...');
  gun2.get(testPath).once((data) => {
    console.log('Gun2 polled data:', data);
  });
}, 3000);

// Timeout handler
setTimeout(() => {
  console.log('\n⏱️ Test timeout reached!');
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS (TIMEOUT)');
  console.log('='.repeat(60));
  console.log(`Total time: ${TEST_TIMEOUT}ms`);
  console.log(`Gun1 Write: ${gun1Wrote ? '✅ PASS' : '❌ FAIL (timeout)'}`);
  console.log(`Gun2 Read: ${gun2Read ? '✅ PASS' : '❌ FAIL (timeout)'}`);
  console.log(`Gun2 Write: ${gun2Wrote ? '✅ PASS' : '❌ FAIL (timeout)'}`);
  console.log(`Gun1 Read: ${gun1ReadBack ? '✅ PASS' : '❌ FAIL (timeout)'}`);
  console.log('='.repeat(60));
  console.log('❌ TESTS FAILED DUE TO TIMEOUT');
  console.log('='.repeat(60));
  
  process.exit(1);
}, TEST_TIMEOUT);
