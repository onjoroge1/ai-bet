const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Define the required structure for a fully enriched prediction
const REQUIRED_STRUCTURE = {
  prediction: {
    match_info: [
      'home_team', 'away_team', 'league', 'date', 'venue', 'match_importance'
    ],
    comprehensive_analysis: [
      'ml_prediction', 'ai_verdict', 'risk_analysis', 'betting_intelligence', 'confidence_breakdown', 'detailed_reasoning'
    ],
    additional_markets: true,
    analysis_metadata: true,
    processing_time: true,
    timestamp: true
  }
};

function checkKeys(obj, required, path = '') {
  let missing = [];
  for (const key in required) {
    if (Array.isArray(required[key])) {
      if (!obj[key]) {
        missing.push(path + key);
      } else {
        for (const subkey of required[key]) {
          if (!obj[key][subkey]) {
            missing.push(`${path}${key}.${subkey}`);
          }
        }
      }
    } else if (typeof required[key] === 'object') {
      if (!obj[key]) {
        missing.push(path + key);
      } else {
        missing = missing.concat(checkKeys(obj[key], required[key], path + key + '.'));
      }
    } else {
      if (!obj[key]) {
        missing.push(path + key);
      }
    }
  }
  return missing;
}

function printObjectStructure(obj, prefix = '') {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${prefix}${key}: {`);
      printObjectStructure(value, prefix + '  ');
      console.log(`${prefix}}`);
    } else {
      console.log(`${prefix}${key}: ${JSON.stringify(value)}`);
    }
  }
}

async function main() {
  const purchaseId = "62480192-a905-4b17-a8e1-e7f45d7df2f5";
  
  console.log(`\n🔍 Looking up Purchase ID: ${purchaseId}`);
  console.log('=' .repeat(60));
  
  // First, find the Purchase record
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      quickPurchase: true
    }
  });

  if (!purchase) {
    console.log('❌ Purchase not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found Purchase record`);
  console.log(`   QuickPurchase ID: ${purchase.quickPurchaseId}`);
  console.log(`   Payment Method: ${purchase.paymentMethod}`);
  console.log(`   Amount: ${purchase.amount}`);
  console.log(`   Status: ${purchase.status}`);

  if (!purchase.quickPurchase) {
    console.log('❌ QuickPurchase not found!');
    await prisma.$disconnect();
    return;
  }

  const qp = purchase.quickPurchase;
  console.log(`\n🔍 Analyzing QuickPurchase ID: ${qp.id}`);
  console.log('=' .repeat(60));

  if (!qp.predictionData) {
    console.log('❌ No predictionData found!');
    await prisma.$disconnect();
    return;
  }

  const data = qp.predictionData;
  const pred = data?.prediction || data; // handle both structures

  console.log('\n📊 CURRENT STRUCTURE:');
  console.log('-'.repeat(40));
  console.log('Top-level keys:', Object.keys(pred));
  
  if (pred.comprehensive_analysis) {
    console.log('\ncomprehensive_analysis keys:', Object.keys(pred.comprehensive_analysis));
    
    // Detailed breakdown of comprehensive_analysis
    console.log('\n📋 COMPREHENSIVE_ANALYSIS DETAILS:');
    console.log('-'.repeat(40));
    printObjectStructure(pred.comprehensive_analysis);
  }

  // Check for missing required fields
  console.log('\n🔍 MISSING FIELDS ANALYSIS:');
  console.log('-'.repeat(40));
  const missing = checkKeys({ prediction: pred }, REQUIRED_STRUCTURE);
  
  if (missing.length) {
    console.log('❌ Missing fields:');
    missing.forEach(field => console.log(`  - ${field}`));
  } else {
    console.log('✅ All required fields present.');
  }

  // Show what we actually have
  console.log('\n📋 ACTUAL DATA STRUCTURE:');
  console.log('-'.repeat(40));
  console.log(JSON.stringify(pred, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
}); 