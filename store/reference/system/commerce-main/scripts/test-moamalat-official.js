#!/usr/bin/env node

/**
 * Test script to validate Moamalat hash generation against official documentation
 * Run with: node scripts/test-moamalat-official.js
 */

const crypto = require('crypto');

function generateSecureHashOfficial(params, secretKey) {
  // 1. Filter out null/undefined values and sort by parameter name
  const sortedKeys = Object.keys(params).filter(key => params[key] !== null && params[key] !== undefined).sort();

  // 2. Construct the string "key=value&key=value"
  const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

  console.log('🔍 Official Hash Generation Debug:');
  console.log('   Sorted Keys:', sortedKeys);
  console.log('   Parameter String:', paramString);
  console.log('   Secret Key (hex):', secretKey);

  // 3. Decode the hex secret key as per documentation
  const secretKeyBuffer = Buffer.from(secretKey, 'hex');
  console.log('   Secret Key (decoded buffer):', secretKeyBuffer);

  // 4. Create a SHA-256 HMAC using the hex-decoded secret key
  const hmac = crypto.createHmac('sha256', secretKeyBuffer);
  hmac.update(paramString);

  // 5. Encode in uppercase hexadecimal
  const hash = hmac.digest('hex').toUpperCase();
  console.log('   Generated Hash:', hash);
  
  return hash;
}

console.log('🧪 Testing Against Official Moamalat Documentation');
console.log('==================================================');

// Test case from official documentation
console.log('\n📚 Official Documentation Test Case:');
const officialParams = {
  Amount: 100,
  DateTimeLocalTrxn: '202009171418',
  MerchantId: '43233',
  MerchantReference: 'Txn-1234',
  TerminalId: '53532091'
};

const officialSecretKey = '35333335653063302D663464372D343237652D623739362D643234666661386432323065';
const expectedHash = 'EAD7AB68E23BFF2E5B03F4A0CD41581722FD14C349C6743CD91B577341465A61';

console.log('Official Parameters:', officialParams);
console.log('Official Secret Key:', officialSecretKey);
console.log('Expected Hash:', expectedHash);

const generatedOfficialHash = generateSecureHashOfficial(officialParams, officialSecretKey);

console.log('\n📊 Official Test Results:');
console.log('   Expected Hash:', expectedHash);
console.log('   Generated Hash:', generatedOfficialHash);
console.log('   Match:', generatedOfficialHash === expectedHash ? '✅ YES' : '❌ NO');

// Now test with your actual parameters
console.log('\n\n🏪 Your Implementation Test:');
console.log('============================');

const yourParams = {
  Amount: 140000, // 140 LYD * 1000 (smallest unit)
  DateTimeLocalTrxn: '202508192154',
  MerchantId: '10081014649',
  MerchantReference: '027e3b8c-546b-47df-8984-47e4df3847f0',
  TerminalId: '99179395'
};

const yourSecretKey = '3a488a89b3f7993476c252f017c488bb';

console.log('Your Parameters:', yourParams);
console.log('Your Secret Key:', yourSecretKey);

const generatedYourHash = generateSecureHashOfficial(yourParams, yourSecretKey);

console.log('\n📊 Your Implementation Results:');
console.log('   URL Hash: D0A70436FB8E28C8AF42A3E7B487E705ADEE1207358D3E311DCE3FE1C0D6A35C');
console.log('   Generated Hash:', generatedYourHash);
console.log('   Match:', generatedYourHash === 'D0A70436FB8E28C8AF42A3E7B487E705ADEE1207358D3E311DCE3FE1C0D6A35C' ? '✅ YES' : '❌ NO');

console.log('\n🔧 Next Steps:');
if (generatedOfficialHash === expectedHash) {
  console.log('✅ Hash generation algorithm is correct');
  if (generatedYourHash !== 'D0A70436FB8E28C8AF42A3E7B487E705ADEE1207358D3E311DCE3FE1C0D6A35C') {
    console.log('❌ Your parameters or secret key need verification');
    console.log('   Check: Merchant ID, Terminal ID, Secret Key with Moamalat');
  } else {
    console.log('✅ Your hash should work! If still getting errors, check other factors');
  }
} else {
  console.log('❌ Hash generation algorithm needs fixing');
}
